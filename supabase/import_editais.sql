-- ============================================================================
-- Importação dos editais extraídos dos PDFs (18/06/2026), com título.
-- Rode no SQL Editor do Supabase. Seguro reexecutar:
--   • o INSERT cria os que faltam (ON CONFLICT DO NOTHING);
--   • o bloco UPDATE no fim preenche/atualiza o título de linhas já existentes.
-- Os cards entram na fase "Triagem". Anexos vazios — anexe os PDFs pelo card.
-- ============================================================================

insert into public.editais (id, data) values
(
  'ed-imp-palotina',
  '{
    "id":"ed-imp-palotina","titulo":"UBS de Palotina","cidade":"Palotina","uf":"PR",
    "tipoServico":"Credenciamento de PJ — serviços médicos (clínica geral) nas UBS · Chamamento Público 002/2026",
    "submissaoInicio":"2026-05-26","submissaoFim":"2027-05-26",
    "modalidade":"ambos",
    "linkEdital":"https://palotina.1doc.com.br/b.php?pg=wp/wp&itd=5",
    "anexos":[],
    "contato":{"nome":"Sheila M. C. Calça (Agente de Contratação)","telefone":"(44) 3649-7800","email":"compras@palotina.pr.gov.br"},
    "fase":"triagem","checklist":[],"verificacoes":[],
    "criadoEm":"2026-06-18T00:00:00.000Z"
  }'::jsonb
),
(
  'ed-imp-mandirituba',
  '{
    "id":"ed-imp-mandirituba","titulo":"Hospital Municipal de Mandirituba","cidade":"Mandirituba","uf":"PR",
    "tipoServico":"Credenciamento de PJ — médicos plantonistas (clínico geral), enfermeiros, técnicos de enfermagem, neurologista clínico/pediátrico (Hospital, Policlínica, CAPS) · Credenciamento 005/2026 (retificado), vigência 6 meses",
    "modalidade":"ambos",
    "linkEdital":"https://mandirituba.pr.gov.br/chamamento-para-credenciamento-de-pessoas-juridicas-especializadas-na-prestacao-de-servicos-de-saude",
    "anexos":[],
    "contato":{"nome":"Comissão de Credenciamento — Mandirituba/PR"},
    "fase":"triagem","checklist":[],"verificacoes":[],
    "criadoEm":"2026-06-18T00:00:00.000Z"
  }'::jsonb
),
(
  'ed-imp-curitiba-mpt',
  '{
    "id":"ed-imp-curitiba-mpt","titulo":"MPT — Procuradoria Regional do Trabalho 9ª Região","cidade":"Curitiba","uf":"PR",
    "tipoServico":"Perícia médica e junta médica oficial — Pregão Eletrônico 90004/2026 (MPT / PRT 9ª Região)",
    "valor":176911.00,
    "submissaoFim":"2026-06-12",
    "modalidade":"online",
    "linkEdital":"https://www.comprasnet.gov.br",
    "anexos":[],
    "contato":{"nome":"CPL — PRT 9ª Região (UASG 200054)","email":"prt09.cpl@mpt.mp.br"},
    "fase":"triagem","checklist":[],"verificacoes":[],
    "criadoEm":"2026-06-18T00:00:00.000Z"
  }'::jsonb
),
(
  'ed-imp-itabera',
  '{
    "id":"ed-imp-itabera","titulo":"Hospital Municipal de Itaberá","cidade":"Itaberá","uf":"SP",
    "tipoServico":"Credenciamento de médicos (retaguarda de transferência, plantonista, visitador, cardiologista, pediatra) · Credenciamento 02/2026 — Edital 33/2026, vigência 12 meses",
    "modalidade":"ambos",
    "linkEdital":"https://www.itabera.sp.gov.br",
    "anexos":[],
    "contato":{"telefone":"(15) 3562-1223"},
    "fase":"triagem","checklist":[],"verificacoes":[],
    "criadoEm":"2026-06-18T00:00:00.000Z"
  }'::jsonb
),
(
  'ed-imp-1781286094',
  '{
    "id":"ed-imp-1781286094","titulo":"(revisar) edital1781286094","cidade":"","uf":"",
    "tipoServico":"REVISAR — edital digitalizado sem camada de texto (arquivo edital1781286094.pdf). Abrir, preencher Cidade/UF e demais dados, e anexar o PDF.",
    "modalidade":"ambos",
    "anexos":[],
    "contato":{},
    "fase":"triagem","checklist":[],"verificacoes":[],
    "criadoEm":"2026-06-18T00:00:00.000Z"
  }'::jsonb
)
on conflict (id) do nothing;

-- Preenche/atualiza o título caso as linhas já tenham sido importadas antes.
update public.editais set data = jsonb_set(data, '{titulo}', '"UBS de Palotina"')                                   where id = 'ed-imp-palotina';
update public.editais set data = jsonb_set(data, '{titulo}', '"Hospital Municipal de Mandirituba"')                  where id = 'ed-imp-mandirituba';
update public.editais set data = jsonb_set(data, '{titulo}', '"MPT — Procuradoria Regional do Trabalho 9ª Região"')  where id = 'ed-imp-curitiba-mpt';
update public.editais set data = jsonb_set(data, '{titulo}', '"Hospital Municipal de Itaberá"')                      where id = 'ed-imp-itabera';
update public.editais set data = jsonb_set(data, '{titulo}', '"(revisar) edital1781286094"')                         where id = 'ed-imp-1781286094';
