import webpush from 'web-push'
import { createServiceClient } from '@/lib/supabase/service'

let configured = false
function configure() {
  if (configured) return
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT!,
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!
  )
  configured = true
}

export interface PushPayload {
  title: string
  body: string
  url: string
}

/**
 * Sends a push notification to every subscription a user has.
 * Never throws — expired/invalid subscriptions (404/410) are pruned; other errors are logged.
 */
export async function sendPushToUser(
  userId: string,
  payload: PushPayload
): Promise<{ sent: number; failed: number }> {
  configure()
  const supabase = createServiceClient()

  const { data: subs } = await supabase
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth')
    .eq('user_id', userId)

  if (!subs?.length) return { sent: 0, failed: 0 }

  let sent = 0
  let failed = 0

  await Promise.all(
    subs.map(async s => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          JSON.stringify(payload)
        )
        sent++
      } catch (err: any) {
        failed++
        const status = err?.statusCode
        if (status === 404 || status === 410) {
          await supabase.from('push_subscriptions').delete().eq('id', s.id)
        } else {
          console.error(`[push] failed for sub ${s.id}:`, status, err?.body ?? err?.message)
        }
      }
    })
  )

  if (failed > 0) {
    console.warn(`[push] user ${userId}: ${sent} sent, ${failed} failed`)
  }

  return { sent, failed }
}
