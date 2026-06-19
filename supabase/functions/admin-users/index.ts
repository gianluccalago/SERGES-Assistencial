// Edge Function: administração de usuários (criar / editar papel-nome / excluir).
// Usa a service_role (secreta, só no servidor) e só aceita chamadas de gestores.
// Deploy: ver supabase/SETUP.md, seção "Administração de usuários".
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const url = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const authHeader = req.headers.get('Authorization') ?? '';

    // Identifica o chamador pelo token da sessão.
    const caller = createClient(url, anonKey, { global: { headers: { Authorization: authHeader } } });
    const {
      data: { user },
    } = await caller.auth.getUser();
    if (!user) return json({ ok: false, error: 'Não autenticado.' });

    // Cliente admin (service_role) — verifica papel e executa ações.
    const admin = createClient(url, serviceKey);
    const { data: perfil } = await admin.from('profiles').select('role').eq('id', user.id).maybeSingle();
    if (perfil?.role !== 'gestor') return json({ ok: false, error: 'Apenas gestores podem administrar usuários.' });

    const body = await req.json();
    const papel = (r: string) => (r === 'gestor' ? 'gestor' : 'equipe');

    if (body.action === 'create') {
      const { email, password, nome, role } = body;
      if (!email || !password) return json({ ok: false, error: 'E-mail e senha são obrigatórios.' });
      if (String(password).length < 6) return json({ ok: false, error: 'A senha precisa ter ao menos 6 caracteres.' });
      const { data: created, error } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { name: nome || email },
      });
      if (error) return json({ ok: false, error: error.message });
      await admin.from('profiles').upsert({ id: created.user.id, email, nome: nome || email, role: papel(role) });
      return json({ ok: true });
    }

    if (body.action === 'update') {
      const { id, role, nome } = body;
      if (!id) return json({ ok: false, error: 'Usuário inválido.' });
      const patch: Record<string, unknown> = {};
      if (role !== undefined) patch.role = papel(role);
      if (nome !== undefined) patch.nome = nome;
      const { error } = await admin.from('profiles').update(patch).eq('id', id);
      if (error) return json({ ok: false, error: error.message });
      return json({ ok: true });
    }

    if (body.action === 'delete') {
      const { id } = body;
      if (!id) return json({ ok: false, error: 'Usuário inválido.' });
      if (id === user.id) return json({ ok: false, error: 'Você não pode excluir o próprio usuário.' });
      const { error } = await admin.auth.admin.deleteUser(id);
      if (error) return json({ ok: false, error: error.message });
      return json({ ok: true });
    }

    return json({ ok: false, error: 'Ação inválida.' });
  } catch (e) {
    return json({ ok: false, error: String(e) }, 500);
  }
});
