import { getClientFingerprint } from './security';
import { supabaseServer } from './supabase/server';

const MAX_ANON_REPORTS_TO_CLAIM = 5;

export async function claimAnonymousReportsForUser(
  request: Request,
  userId: string,
) {
  const { fingerprint } = getClientFingerprint(request);

  const { data: anonymousReports, error: selectError } = await supabaseServer
    .from('reports')
    .select('id')
    .is('user_id', null)
    .eq('reporter_fingerprint', fingerprint)
    .order('created_at', { ascending: true })
    .limit(MAX_ANON_REPORTS_TO_CLAIM);

  if (selectError || !anonymousReports || anonymousReports.length === 0) {
    return {
      claimed: 0,
      error: selectError ?? null,
    };
  }

  const reportIds = anonymousReports.map((item) => item.id);

  const { error: updateError } = await supabaseServer
    .from('reports')
    .update({
      user_id: userId,
      reporter_fingerprint: null,
    })
    .in('id', reportIds);

  return {
    claimed: updateError ? 0 : reportIds.length,
    error: updateError ?? null,
  };
}
