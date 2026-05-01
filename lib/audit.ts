import { getRequestInfo } from './security';
import { supabaseServer } from './supabase/server';

type Actor = {
  type: 'user' | 'official' | 'system';
  id?: string | null;
};

export async function writeAuditLog(
  request: Request,
  actor: Actor,
  action: string,
  resourceType: string,
  resourceId: string,
  metadata?: Record<string, unknown>,
) {
  const { ip, userAgent } = getRequestInfo(request);
  const { error } = await supabaseServer.from('audit_log').insert({
    actor_type: actor.type,
    actor_id: actor.id ?? null,
    action,
    resource_type: resourceType,
    resource_id: resourceId,
    metadata: metadata ?? null,
    ip_address: ip,
    user_agent: userAgent,
  });

  if (error && error.code !== '42P01') {
    console.error('[audit]', error);
  }
}
