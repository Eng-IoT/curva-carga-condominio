# Curva de Carga para Condomínios

Ferramenta digital em **Next.js + React + TypeScript** para simular a curva de carga de condomínios com infraestrutura de recarga de veículos elétricos.

## Funcionalidades

- Geração de curva base estimada a partir de:
  - quantidade de apartamentos;
  - demanda diversificada por unidade;
  - pico de áreas comuns.
- Entrada de curva real/manual com 24 valores horários.
- Importação de CSV com 24 pontos ou colunas `hora;demanda`.
- Simulação de carregadores EV considerando:
  - potência por carregador;
  - quantidade de carregadores;
  - fator de simultaneidade;
  - horário de ponta;
  - margem de reserva;
  - load balancing;
  - recarga programada fora de ponta.
- Comparação de três curvas:
  - carga base;
  - total sem gerenciamento;
  - total com gerenciamento.
- Indicadores automáticos:
  - pico de demanda;
  - horas acima da demanda contratada;
  - redução de pico;
  - máximo simultâneo seguro estimado;
  - simultaneidade segura estimada;
  - energia EV solicitada, atendida e não atendida.
- Exportação dos resultados em CSV.
- Dados persistidos no navegador via `localStorage`.
- Layout responsivo para desktop, tablet e smartphone.

## Instalação local

Requisitos: Node.js 20+ e npm.

```bash
npm install
npm run dev
```

Abra:

```text
http://localhost:3000
```

## Build de produção

```bash
npm run build
npm start
```

## Publicar no GitHub

```bash
git init
git add .
git commit -m "feat: simulador de curva de carga condominial"
git branch -M main
git remote add origin https://github.com/SEU-USUARIO/curva-carga-condominio.git
git push -u origin main
```

## Publicar na Vercel

1. Faça o push do projeto para o GitHub.
2. Acesse a Vercel.
3. Clique em **Add New > Project**.
4. Importe o repositório.
5. Framework detectado: **Next.js**.
6. Clique em **Deploy**.

Nenhuma variável de ambiente é necessária nesta versão.

## Formato CSV aceito

### Opção 1 — 24 linhas

```csv
hora;demanda
0;18
1;17
2;16
...
23;22
```

### Opção 2 — 24 valores

```text
18;17;16;15;15;16;20;28;34;36;35;34;33;34;35;38;42;48;52;54;50;44;36;22
```

## Nota técnica

A ferramenta é destinada a **estudo e pré-dimensionamento**. O modo estimado não substitui medições reais. Para projetos executivos, utilize curvas obtidas por analisador de energia, medidores inteligentes ou dados da concessionária e valide os resultados conforme as normas aplicáveis e os requisitos da distribuidora.
