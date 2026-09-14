import { getAuthenticatedMember } from '../../_lib/auth.js';

export async function onRequestGet({ request, env }) {
  const member = await getAuthenticatedMember(request, env);
  return Response.json({ authenticated: !!member, member: member || null }, {
    headers: { 'Cache-Control': 'no-store' }
  });
}
