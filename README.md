# Lojinha EntreGô

Aplicação full-stack para transformar a produção mensal dos entregadores em pontos, permitir resgates com controle transacional e administrar todo o ciclo por uma planilha Excel.

## O que já está coberto

- Cadastro por CNPJ vinculado a um entregador previamente importado e ainda sem conta.
- Login por CNPJ ou e-mail, sessão segura em cookie `httpOnly` e logout.
- Recuperação de senha por e-mail com token de uso único e validade de 1 hora.
- Importação da guia `BANCO DE DADOS`, usando automaticamente a Guia de CNPJ permanente do sistema; `DADOS CNPJ` é um complemento opcional.
- Coluna de pontos configurável; a coluna R vem como padrão.
- Créditos por data, proteção contra datas repetidas, ajustes e expiração por ciclo.
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
2. Envie o arquivo `.xlsx` com a guia `BANCO DE DADOS` e escolha a coluna de pontos (R por padrão).
3. Confira na prévia as datas encontradas, os pontos, entregadores e avisos.
4. Confirme a importação. Os pontos são somados ao ciclo vigente.

As datas são lidas da planilha e devem pertencer ao ciclo vigente. Se qualquer data já tiver sido importada, o arquivo inteiro é recusado. O mesmo vale para importações antigas sem datas detalhadas no mês, até que o histórico seja revisado. A guia `DADOS CNPJ` é opcional: a base em **Conciliação > Guia de CNPJ** é aplicada automaticamente.

## Identidade por CNPJ

O identificador de acesso correto é o CNPJ. A coluna F da guia principal continua sendo o UUID usado para consolidar as linhas mensais. A base permanente fica em **Conciliação > Guia de CNPJ**, onde o administrador pode adicionar ou editar nome, CNPJ e o entregador vinculado. Depois da carga do `informativo.xlsx`, 1.356 entregadores ativos estão com CNPJ e 116 permanecem pendentes.

Depois do vínculo, o entregador pode criar a própria conta informando CNPJ, e-mail e senha. O cadastro só é aceito quando o CNPJ já existe na base, o entregador não está inativo e ainda não possui uma conta vinculada.

A análise completa e mascarada está em [`docs/analise-planilha.md`](docs/analise-planilha.md).

## Ciclo de pontos

- Os pontos de arquivos com datas diferentes são somados ao ciclo vigente.
- O primeiro ciclo começa em 16/11/2026 e termina em 31/01/2027; os seguintes duram 75 dias.
- O saldo disponível é `créditos importados + ajustes - resgates`.
- Ao iniciar um novo ciclo, o saldo anterior expira e a movimentação fica registrada no extrato.
- Cancelamentos devolvem estoque e os pontos de contas ainda abertas.

## Verificações

```bash
npm run lint
npm run typecheck
npm test
npm run build
npm run smoke:redemption
npm run smoke:import
npm run verify:data
npm run verify:performance
npm run db:migrate
npm audit
```

O smoke de resgate cria dados isolados, disputa simultaneamente o último item e confirma que somente um pedido debita saldo e estoque. O smoke de importação valida idempotência, deltas e concorrência com um resgate. `verify:performance` confirma os índices críticos e impõe um teto de 50 ms para as consultas principais no banco. Os dados temporários são removidos ao final.

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
