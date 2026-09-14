# Banco de dados na Vercel

O `500` do login e o `503` de `/api/health` indicam que a função publicada não consegue alcançar o PostgreSQL. Configure as variáveis no projeto **lojinha-pontos**, nos ambientes Production, Preview e Development, e faça um novo deploy.

| Variável | Uso |
| --- | --- |
| `DATABASE_URL` | Pooler transacional do Supabase: porta `6543`, usuário `postgres.<project-ref>`, com `sslmode=require`, `pgbouncer=true`, `connection_limit=1` e `pool_timeout=20`. |
| `DIRECT_URL` | Pooler de sessão: porta `5432`, usuário `postgres.<project-ref>`, com `sslmode=require`. Usada apenas por migrations e ferramentas. |
| `APP_URL` | URL HTTPS pública da aplicação. |
| `NEXT_PUBLIC_APP_URL` | A mesma URL HTTPS pública. |
| `AUTH_AUDIT_SALT` | Segredo aleatório, longo e exclusivo. |

Não use a conexão direta `db.<project-ref>.supabase.co` no runtime serverless. Depois de salvar as variáveis, confirme:

```text
GET /api/health  ->  {"status":"healthy"}
POST /api/auth/login  ->  200 ou 401, nunca 500
```

As credenciais não devem ser colocadas no Git, em arquivos públicos ou no código do cliente. Se uma senha tiver sido compartilhada fora do cofre de segredos, rotacione-a no Supabase e atualize as duas URLs na Vercel.
