# Painel Administrativo Exclusivo | Ação Solidária Missionária 🚗⛪

Este é o repositório **isolado e seguro** do **Painel de Gestão e Disparos da Rifa Missionária**, separado do site público dos compradores.

Desta forma, os visitantes da página principal da rifa **não têm acesso** a dados confidenciais de apoiadores, CPFs, telefones, disparador de WhatsApp ou botões administrativos.

---

## 🚀 Como Subir na Vercel (1 Minuto)

1. Acesse sua conta na [Vercel](https://vercel.com) e clique em **"Add New..."** ➔ **"Project"**.
2. Conecte sua conta do GitHub e escolha o repositório:
   **`autoinstagram755-del/painel-admin-rifa`**
3. Em **Environment Variables** (opcional, ou configure direto no painel web):
   - `VITE_SUPABASE_URL`: sua URL do Supabase
   - `VITE_SUPABASE_ANON_KEY`: sua chave anônima do Supabase
   - `VITE_ADMIN_PIN`: sua senha mestra (padrão: `missao2026`)
4. Clique em **"Deploy"**.
5. Pronto! Você receberá uma URL exclusiva (ex: `https://painel-admin-rifa.vercel.app`) para você e sua equipe gerenciarem a campanha com segurança total.

---

## 🔒 Recursos do Painel

- **Tela de Bloqueio por Senha/PIN**: Protegido por senha (padrão `missao2026`), com opção de "Manter conectado".
- **Dashboard de Arrecadação em Tempo Real**:
  - Total arrecadado em R$ e progresso da meta (R$ 8.500).
  - Contagem de cotas Pagas, Reservadas e Disponíveis.
- **Gestão de Pedidos**:
  - Filtros rápidos (Pagos, Pendentes, Cancelados).
  - Busca instantânea por Nome, Telefone/WhatsApp, CPF e ID do Pedido.
  - Confirmação manual de pagamentos ("Dar Baixa").
  - Cancelamento de pedidos com liberação imediata das cotas.
- **Venda Balcão / Manual (Dinheiro / Maquininha / Pix Direto)**:
  - Para pessoas que pagam em mãos ou não sabem usar a internet.
  - Seleção por quantidade (combos) ou números específicos.
  - Ocupação imediata das cotas na grade pública.
  - Geração automática de comprovante oficial para envio no WhatsApp do comprador com 1 clique.
- **Central WhatsApp & Controle de 3 Horas (Anti-Ban)**:
  - Cronômetro regressivo de 3 horas em tempo real para reservas pendentes.
  - Botão de Lembrete de 1 Hora (com mensagem amigável, menção ao nome da pessoa, cotas escolhidas e reforço da missão).
  - Botão de Aviso de 15 Minutos (alerta de urgência antes da liberação das cotas).
  - Botão de Liberação de Cotas Expiradas (+3 horas).
  - **100% Anti-Ban**: Utiliza links diretos e legítimos do WhatsApp (`api.whatsapp.com`), eliminando qualquer risco de banimento de número por spam robótico.
- **Banco de Dados & Supabase**:
  - Configuração visual da conexão com o mesmo banco da rifa pública.
  - Script SQL das tabelas pronto para copiar e colar.
