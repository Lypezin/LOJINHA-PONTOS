# DESIGN.md — Lojinha EntreGô Design System

Este documento captura o sistema visual da **Lojinha EntreGô** para garantir consistência estética leve, limpa e refinada em toda a interface.

---

## Paleta de Cores e Tokens

### Cores de Marca e Superfícies
* `--brand-navy`: `#0b1633` (Principal, azul marinho profundo para títulos, cabeçalhos e cartão de saldo).
* `--brand-blue`: `#1d56e8` (Destaque, azul primário para ações principais, links ativos e estados selecionados).
* `--brand-blue-dark`: `#1644bd` (Hover e estado ativo de ações primárias).
* `--brand-mint`: `#10b981` / `--brand-mint-ink`: `#065f46` (Indicadores de pontos, elegibilidade e sucesso).
* `--background`: `#f6f8fb` (Fundo neutro frio suave).
* `--surface`: `#ffffff` / `--surface-soft`: `#f1f5f9`.
* `--line`: `#e2e8f0` (Bordas finas e divisores).

---

## Tipografia
* **Títulos (`font-display`)**: `Plus Jakarta Sans` (`500`, `600`, `700`) com tracking ajustado (`-0.02em`).
* **Corpo e UI (`font-sans`)**: `Inter` (`400`, `500`, `600`, `700`).
* **Números e Pontos**: `font-variant-numeric: tabular-nums` obrigatório em saldos, preços em pontos e tabelas.

---

## Layout e Estrutura Visual
* **Bordas e Cantos**:
  * Cartões, containers e modais usam `rounded-2xl` (16px).
  * Botões, inputs, tabs e itens internos usam `rounded-xl` (12px).
  * Pills de filtro e status usam `rounded-full`.
* **Superfícies e Elevação**:
  * Bordas finas `border border-slate-200/80` com sombra sutil `shadow-[0_1px_2px_rgba(15,23,42,0.04)]` (evitar empilhar anéis ou sombras pesadas).
* **Ritmo Visual**:
  * Mobile-first pensado para navegação dentro do aplicativo (WebView), com header translúcido compacto e navegação inferior respeitando `safe-area-inset-bottom`.
