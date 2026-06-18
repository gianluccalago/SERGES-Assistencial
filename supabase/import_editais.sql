-- ============================================================================
-- Importação única de editais (extraídos dos PDFs enviados em 18/06/2026).
-- Rode UMA VEZ no SQL Editor do Supabase. Idempotente (ON CONFLICT DO NOTHING).
-- Os cards entram na fase "Triagem" do Setor Comercial Público.
--
-- Obs.: os anexos ficam vazios — os PDFs não estão no Storage. Abra cada card
-- e use "Enviar arquivo" para anexar o PDF correspondente (ou cole o link).
-- ============================================================================

insert into public.editais (id, data) values
(
  'ed-imp-palotina',
  '{
    "id":"ed-imp-palotina","cidade":"Palotina","uf":"PR",
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
    "id":"ed-imp-mandirituba","cidade":"Mandirituba","uf":"PR",
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
    "id":"ed-imp-curitiba-mpt","cidade":"Curitiba","uf":"PR",
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
    "id":"ed-imp-itabera","cidade":"Itaberá","uf":"SP",
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
    "id":"ed-imp-1781286094","cidade":"","uf":"",
    "tipoServico":"REVISAR — edital digitalizado sem camada de texto (arquivo edital1781286094.pdf). Abrir, preencher Cidade/UF e demais dados, e anexar o PDF.",
    "modalidade":"ambos",
    "anexos":[],
    "contato":{},
    "fase":"triagem","checklist":[],"verificacoes":[],
    "criadoEm":"2026-06-18T00:00:00.000Z"
  }'::jsonb
)
on conflict (id) do nothing;
