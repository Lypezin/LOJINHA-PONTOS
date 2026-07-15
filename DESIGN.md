# DESIGN.md — Lojinha EntreGô Design System

Este documento captura o sistema visual da **Lojinha EntreGô** para garantir consistência estética premium em qualquer nova interface ou componente.

---

## 🎨 Paleta de Cores e Tokens

### Cores de Marca
*   `--brand-navy`: `#0c1938` (Principal, azul escuro profundo para textos, cabeçalhos e elementos fortes).
*   `--brand-blue`: `#1a56db` (Destaque, azul elétrico para links ativos, botões primários e marcações).
*   `--brand-blue-dark`: `#1e40af` (Hover e foco de botões).
*   `--surface-soft`: `#f8fafc` (Cor de fundo principal para toda a aplicação).

### Status e Alertas
*   **Success (Sucesso/Ativo)**: `--success-base` (`#10b981`), fundo soft (`#ecfdf5`).
*   **Warning (Pendente/Alerta)**: `--warning-base` (`#f59e0b`), fundo soft (`#fffbeb`).
*   **Danger/Error (Inativo/Erro)**: `--danger-base` (`#ef4444`), fundo soft (`#fef2f2`).

---

## font-family & Tipografia
*   **Títulos e Destaques**: Fonte `Outfit` ou `Inter` (sans-serif) para peso extra-negrito e visual moderno.
*   **Corpo de Texto**: Fonte `Inter` (sans-serif) para leitura legível e limpa.
*   **Tabelas e Valores**: Configurar `font-variant-numeric: tabular-nums` para alinhar números e pontos.

---

## 📐 Layout e Estrutura Visual
*   **Bordas e Cantos**:
    *   Cartões principais e seções operacionais devem usar `rounded-[20px]` (arredondamento suave de 20px).
    *   Botões e inputs padrão usam `rounded-xl` (12px).
*   **Sombras e Elevação**:
    *   Utilizar sombras suaves baseadas em `shadow-sm` combinadas com contornos sutis (`border border-slate-200` ou `ring-1 ring-slate-950/[0.02]`).
*   **Visual Rhythm**:
    *   Páginas administrativas utilizam espaçamentos consistentes de `space-y-8` ou `space-y-10`.
    *   Tabelas de dados utilizam padding interno de `px-5 py-4` para dar respiro visual.

---

## 🧩 Componentes Padronizados
1.  **PageHeader**:
    *   Utilizado no topo de todas as telas principais com um `eyebrow` (competência ou subpílula), título grande e descrição curta do fluxo.
2.  **StatCard**:
    *   Cartões informativos de contagem e saldos dispostos no topo das páginas em grids responsivos.
3.  **StatusBadge**:
    *   Pílulas pequenas com fundo soft e texto contrastante forte para representar estados de resgates e entregadores.
