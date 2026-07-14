# Lojinha EntreGô

Aplicação full-stack para transformar a produção mensal dos entregadores em pontos, permitir resgates com controle transacional e administrar todo o ciclo por uma planilha Excel.

## O que já está coberto

- Cadastro por CNPJ e código de ativação vinculado a um entregador previamente importado.
- Login por CNPJ ou e-mail, sessão segura em cookie `httpOnly` e logout.
- Recuperação de senha por e-mail com token de uso único e validade de 1 hora.
- Importação das guias `BANCO DE DADOS` e `DADOS CNPJ`.
- Coluna de pontos configurável; a coluna R vem como padrão.
- Créditos por competência mensal, reimportação idempotente, ajustes e expiração.
- Conciliação automática conservadora de CNPJ e fila de revisão manual.
- Catálogo com foto, categoria, pontos, valor de referência, estoque, destaque, limite mensal e status.
- Resgate atômico: saldo e estoque são baixados juntos, com proteção contra concorrência e repetição.
- Histórico de pontos e de resgates.
- Painel administrativo para importações, produtos, resgates, entregadores, conciliação e configurações.
- Auditoria das ações sensíveis.

## Requisitos

- Node.js 20.12 ou mais recente.
- PostgreSQL acessível por `DATABASE_URL` (pooler transacional para a aplicação) e `DIRECT_URL` (migrações/seed).
- Uma conta Resend e domínio validado para recuperação de senha em produção.

## Instalação

```bash
npm install
npm run db:generate
npm run db:migrate
npm run db:seed
npm run dev
```

A aplicação fica disponível em `http://localhost:3000`.

Copie `.env.example` para `.env.local` e preencha os valores. O banco já configurado neste workspace foi sincronizado e recebeu os dados iniciais. O arquivo `ATT LOJINHA.xlsx` fornecido também já foi importado na competência 2026-07: 32.758 linhas, 1.471 entregadores e 107.378 pontos.

## Acessos iniciais de desenvolvimento

- Admin: `admin@lojinha.local` / `TroqueAgora#2026`
- Entregador de demonstração: `entregador@demo.local` / `Demo@12345`
- CNPJ de demonstração: `11.222.333/0001-81`

Troque a senha administrativa antes de publicar a aplicação. O primeiro login administrativo força essa troca. Em desenvolvimento, o fluxo “Esqueci minha senha” retorna o link de redefinição na própria resposta quando o Resend não está configurado.

O banco local deste workspace já contém o entregador de demonstração. Em uma instalação nova, defina temporariamente `SEED_DEMO_DATA=true` antes de executar o seed caso queira criar esses dados. A senha de um admin já existente só é rotacionada pelo seed quando `ROTATE_ADMIN_PASSWORD=true`.

## Como importar o Excel

1. Entre como administrador e abra **Importações**.
2. Selecione a competência (`AAAA-MM`) e o arquivo `.xlsx`.
3. Confirme a guia principal e escolha a coluna que valerá pontos. A coluna R, `numero_de_pedidos_aceitos_e_concluidos`, aparece pré-selecionada.
4. Revise o resumo: linhas, entregadores, total de pontos, diferença para o lote anterior e pendências de CNPJ.
5. Confirme a importação.

Cada arquivo é tratado como o retrato completo daquela competência. Reenviar exatamente o mesmo arquivo não duplica pontos; enviar uma versão atualizada lança somente a diferença por entregador.

## Identidade por CNPJ

O identificador de acesso correto é o CNPJ da guia `DADOS CNPJ`. A coluna F da guia principal continua sendo o UUID usado para consolidar as linhas mensais; o vínculo entre UUID, nome e CNPJ é feito pela conciliação das duas guias. No arquivo fornecido, 1.334 dos 1.471 entregadores foram vinculados automaticamente a um CNPJ único. Os outros 137 precisam de confirmação no painel **Conciliação** antes do cadastro.

Depois do vínculo, o administrador gera um código de ativação de uso único para o entregador. O cadastro exige CNPJ, código, e-mail e senha. Esse código é necessário porque CNPJs podem ser consultados publicamente e, sozinhos, não provam quem está criando a conta.

A análise completa e mascarada está em [`docs/analise-planilha.md`](docs/analise-planilha.md).

## Regra mensal de pontos

- Cada competência possui conta e extrato próprios.
- O saldo disponível é `créditos importados + ajustes - resgates`.
- Ao abrir um novo mês, saldos de competências anteriores são expirados e deixam de ficar disponíveis.
- A expiração não apaga o dado: ela cria um lançamento no extrato para auditoria.
- Cancelamentos dentro da competência aberta devolvem os pontos e o estoque.

## Verificações

```bash
npm run lint
npm run typecheck
npm test
npm run build
npm run smoke:redemption
npm run smoke:import
npm run verify:data
npm run db:migrate
npm audit
```

O smoke de resgate cria dados isolados, disputa simultaneamente o último item e confirma que somente um pedido debita saldo e estoque. O smoke de importação valida idempotência, deltas e concorrência com um resgate. Os dados temporários são removidos ao final.

## Publicação

Antes de publicar:

1. configure `NEXT_PUBLIC_APP_URL` e `APP_URL` com HTTPS;
2. use o pooler transacional do Supabase (`6543`) em `DATABASE_URL` com `pgbouncer=true&connection_limit=1`;
3. use a conexão de sessão (`5432`) em `DIRECT_URL` para migrações e seed;
4. troque `ADMIN_EMAIL`, `ADMIN_PASSWORD` e `AUTH_AUDIT_SALT`;
5. configure `RESEND_API_KEY` e `EMAIL_FROM`;
6. mantenha `SEED_DEMO_DATA=false`;
7. execute `npm run db:migrate` para aplicar as migrações versionadas;
8. execute `npm run build` e os testes;
9. faça backup do PostgreSQL e defina política de retenção para os registros de auditoria.

Fotos enviadas pelo painel são armazenadas como URL ou `data URL` limitada. Para um catálogo grande, recomenda-se trocar por um bucket S3/Supabase Storage sem alterar o restante do domínio.

## Estrutura

- `src/app`: páginas e rotas HTTP.
- `src/features`: regras de importação, pontos e resgates.
- `src/lib`: banco, autenticação, validações e utilitários.
- `prisma/schema.prisma`: modelo de dados.
- `prisma/seed.ts`: admin, configurações e catálogo de demonstração.
- `docs/design-system.md`: identidade visual baseada em referências oficiais da EntreGô.
- `lojinha-entrego-plan.md`: arquitetura, regras e critérios de aceite.
