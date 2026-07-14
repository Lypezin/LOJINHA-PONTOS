# Plano de construção — Lojinha EntreGÔ

## Objetivo

Entregar uma aplicação web full-stack pronta para operação, alimentada mensalmente por Excel, com autenticação de entregadores, saldo de pontos por competência, catálogo de produtos, resgates seguros, histórico e administração completa.

## Decisões de arquitetura

- Next.js com App Router, TypeScript e Tailwind CSS.
- PostgreSQL (conexão já configurada) com Prisma como ORM.
- Autenticação própria por CPF/e-mail e senha, sessões seguras em cookie `httpOnly`, perfis `ADMIN` e `COURIER`.
- Recuperação por token de uso único enviado por e-mail; em desenvolvimento, o link também fica disponível no console para permitir teste sem provedor externo.
- A planilha é a fonte de verdade dos créditos mensais. Cada importação cria uma competência e uma trilha auditável; reimportações não duplicam pontos.
- O saldo operacional não será um número solto: será calculado por lançamentos de crédito, débito, ajuste e expiração vinculados a uma competência mensal.
- Pontos não usados ficam indisponíveis ao virar o mês, mas permanecem no histórico para auditoria.
- Resgate e baixa de estoque acontecem na mesma transação de banco para impedir saldo negativo, estoque negativo ou duplo resgate.
- A coluna de pontos é configurável no painel, com a coluna R / `numero_de_pedidos_aceitos_e_concluidos` como padrão inicial.
- O vínculo de CNPJ usa CPF quando disponível e comparação normalizada/fuzzy de nomes; casos incertos entram em uma fila de conciliação manual.
- Fotos de produtos aceitarão upload e URL, com limites e validação.

## Módulos

1. **Autenticação**: cadastro vinculado ao CPF importado, login, logout, recuperação e redefinição de senha.
2. **Importações**: upload `.xlsx`, pré-visualização, escolha da coluna de pontos, competência, validações, resumo e histórico de lotes.
3. **Entregadores/CNPJ**: cadastro mestre, correspondências automáticas, conflitos e edição manual.
4. **Pontos**: créditos mensais idempotentes, ajustes administrativos, extrato, saldo vigente e expiração por competência.
5. **Catálogo**: produtos, categorias, foto, descrição, custo em pontos, valor de referência, estoque, limites e status.
6. **Resgates**: confirmação, débito e estoque atômicos, código do pedido, status e gestão administrativa.
7. **Área do entregador**: início, vitrine, detalhes, saldo, resgates/histórico e perfil.
8. **Administração**: visão geral, produtos, pedidos, entregadores, importações, conciliações, ajustes e configurações.

## Regras críticas

- CPF é armazenado normalizado e único.
- Um cadastro de entregador só é permitido se o CPF existir em uma importação válida e ainda não estiver vinculado a outra conta.
- A importação da mesma competência e entregador atualiza o crédito-base, gerando somente a diferença auditável.
- O usuário só pode gastar pontos da competência ativa; saldo anterior aparece como expirado no histórico.
- Não há resgate se produto estiver inativo, sem estoque, fora do limite ou se o saldo for insuficiente.
- Cada alteração administrativa relevante gera registro de auditoria.

## Critérios de aceite

- Importar o arquivo fornecido e mapear as duas guias.
- Permitir trocar a coluna usada como pontos pelo painel.
- Cadastrar e autenticar um CPF importado.
- Recuperar/redefinir senha por fluxo tokenizado.
- Criar, editar, ativar/desativar e controlar estoque de produtos com foto.
- Resgatar com débito exato, baixa exata e proteção contra concorrência.
- Exibir histórico do entregador e fila administrativa de pedidos.
- Conciliar automaticamente nomes/CNPJ e permitir correção manual.
- Exibir competência atual, validade e regra de expiração claramente.
- Passar em lint, checagem de tipos, build e testes automatizados dos cálculos/fluxos críticos.
- Funcionar bem em desktop e celular com identidade predominantemente azul e branca.

## Fases

1. Análise da planilha, marca e ambiente.
2. Scaffold, schema, migrações e dados iniciais.
3. Autenticação e serviços de domínio.
4. Importação e conciliação.
5. Loja, resgates e histórico.
6. Painel administrativo.
7. Polimento visual, acessibilidade e responsividade.
8. Testes, build, auditoria estrutural e documentação.
