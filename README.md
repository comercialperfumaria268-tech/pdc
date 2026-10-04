# Estoque & PDV (VS Code + Supabase)

Sistema de estoque, PDV, financeiro, crediário, NF-e e promoções. Roda no navegador; os dados ficam no Supabase.

## 1. Criar o banco no Supabase
1. Crie um projeto em https://supabase.com.
2. Abra **SQL Editor > New query**, cole o conteúdo de `supabase/schema.sql` e clique em **Run**.
3. Vá em **Authentication > Users > Add user**, crie um e-mail e senha (é o login de acesso ao sistema). Em **Authentication > Sign In / Providers**, desative "Allow new users to sign up".
4. Em **Project Settings > API**, copie a **Project URL** e a chave **anon public**.

## 2. Configurar
Edite `config.js` e cole a URL e a anon key. Nunca use a chave `service_role` aqui.

## 3. Rodar no VS Code
- Abra a pasta no VS Code, instale a extensão **Live Server** e clique em **Go Live**; ou
- no terminal: `npm start` (abre em http://localhost:5500).

Entre com o e-mail/senha do passo 1. Na primeira vez o sistema pede para criar o administrador (PIN de 4 dígitos).

## Migrar os dados da versão web
Na versão antiga: aba **Backup > Copiar backup**. No sistema novo: aba **Backup**, cole o texto e clique em **Restaurar do texto**. Tudo é enviado ao Supabase.

## Como funciona
- Tabelas: `products, clients, users, sales, moves, nfes, ap, ar, conf, promos, settings`, cada uma com `id`, `data` (jsonb) e `updated_at`.
- O canto inferior direito mostra o estado do salvamento. Alterações são enviadas ao Supabase poucos instantes depois.
- Sem configurar o `config.js`, o sistema funciona em modo local (dados no navegador).

## Limitações
- Pensado para um computador/caixa por vez: com dois dispositivos editando juntos, vale o último a salvar.
- Os PINs dos usuários internos ficam no banco em texto. O acesso é protegido pelo login do Supabase, mas não é segurança forte.
- Cupom é não fiscal; não há emissão de NFC-e/SAT.
