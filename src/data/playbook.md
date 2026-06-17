# Oráculo — Playbook de Obrigações (SERGES)

Consulta rápida e offline das regras operacionais do cargo de Assistente de
Projetos. A fonte viva e completa é o notebook no NotebookLM (botão **Abrir no
NotebookLM**). Valores de hora e de consulta **não** ficam neste app — consulte
sempre o Oráculo / planilha de regras.

## Status e selos

Os status são exatamente quatro: **Pendente**, **Aguardando input do
contratante**, **Em aprovação do Gestor** e **Concluído**. *Atrasada*,
*Crítico* e *Escalado* não são status — são selos que coexistem com o status.
*Cobrar* e *Escalar* são ações, não status. Itens aguardando o contratante não
são concluídos direto: a ação é cobrar e, ao chegar, registrar o retorno.

## Contatos

A aba **Contatos** é a fonte única de contatos (contratantes, internos,
contabilidade). É de lá que sai o contato de cobrança das obrigações que
aguardam o contratante e a cadeia de escalonamento.

## Regras de dia útil

- **Prazos críticos antecipam.** Prazo interno de fechamento (cards prontos,
  0600, FOPAM) que cai em dia não útil recua para o dia útil anterior. Nunca adia.
- **Pagamentos e datas genéricas adiam.** Caindo em dia não útil, seguem o
  próximo dia útil.
- **Regra dos 5 dias** (dias corridos): card de pagamento = dia nominal de
  pagamento − 5, antecipando se cair em dia não útil. Vale para todos.
- **Feriados**: nacionais fixos + móveis derivados da Páscoa (Carnaval, Sexta
  Santa, Corpus Christi). Feriados municipais são editáveis na tela Feriados.

## Tipos de obrigação

- **Card de pagamento** — por projeto ativo, pagamento − 5 dias. Academia: card
  do Fred sempre no dia 1.
- **Iniciar faturamento** — cobrar o contratante. Dia 1 (maioria), dia 16 (ASF).
- **Card de faturamento** — sem data fixa; nasce *aguardando retorno de terceiro*
  e só vira tarefa quando o retorno é registrado. Não vira atrasada sozinho.
- **Tarefas fixas** — dia 1 (faturar valor fixo + iniciar cobranças), dia 2
  (documentação FUNEAS/HRL/HZN/HRNP), dia 3 (fechar Academia, NF do Fred), dia
  16 (iniciar ASF e 0600), dias 22–24 (finalizar 0600, crítico), dia 20 (enviar
  contrato social à contabilidade).
- **Apresentações** — completa (1º dia útil do mês) e parcial (1º dia útil após
  o dia 15).
- **FOPAM de fechamento** — último dia útil do mês.

## Lote de pagamento e guardrails (§4.3, §11.2)

O pagamento de um projeto no mês é um **lote** com um card por médico. Cada card
de médico tem guardrails próprios:

- **Fundamentais (bloqueiam o card pronto)**: planilha de origem anexada e PIX
  conferido (a chave corresponde ao vínculo, sócio ou PJ).
- **SERGES Connect** (ex-ASPA): não bloqueia. Três opções — Realizada,
  Parcialmente ou Nada — confirmando que o médico validou o valor das horas.

O lote só conclui quando **todos** os cards de médico estão prontos e aprovados
(mostra progresso, ex.: 12 de 15). Se o projeto exige **contrato social**: aviso
destacado — nota fiscal não permitida, risco de quarteirização.

## Sub-workflow da ASF (§11.3)

Estados: Enviado à Daniela → Correções solicitadas → Em correção pelo Rodrigo →
Aprovado. Só após **Aprovado** libera o card de faturamento e, em seguida, a 0600.

## Processo 0600 (§11.4)

Liberar só após faturamento da ASF aprovado e notas fiscais emitidas. Conferir a
divisão regional: **Norte**, **Capela do Socorro** e **Parelheiros**. Campos
numéricos de apoio: no máximo duas casas decimais. O preenchimento real é no
portal da ASF.

## Ordem de compra e notas fracionadas (§11.5)

- Projetos com **ordem de compra** (ex.: New Life Maceió) ficam travados em
  *aguardando retorno* até marcar **OC recebida**.
- **Ipiranga** e **Herval**: usar o cálculo de notas fracionadas (teto por nota
  configurável no projeto).

## ZapSign — documentação FUNEAS (§11.6)

Colar o link do ZapSign enviado ao Giuliano e ao hospital e registrar o **ok da
fundação**. Só liberar os cards finais após o ok.

## Esteiras do contrato social (§11.7)

- **Ingresso**: mover dados → enviar procuração (boleto vence em 3 dias) →
  validar assinatura da procuração e da cota.
- **Saída**: gerar card de devolução de **R$ 50**, sem prazo crítico, no mês
  seguinte.
- **Virada contratual (dias 11–17)**: unir entradas e saídas confirmadas com os
  escalistas Rodrigo e Danneline; compactar documentos (procuração + CNH/RG)
  para a Estilocont. Pré-requisito do envio do dia 20.

## Escalonamento por silêncio (§11.8)

Cada projeto tem um contato primário e para quem escalar. Quando uma cobrança
passa do limite, acionar o contato de escalonamento. Ex.: ASF — Daniela sem
resposta, acionar Cynthia (RH Regional).

## FOPAM de fechamento (§11.9)

Cruzar por projeto: faturado, custo pago e margem bruta; confirmar o envio do
e-mail ao Bismarck.

## Aprovações

Aprovação de cards pelo coordenador/gestor tem expectativa de **24 horas**. O app
sinaliza quando passa disso.
