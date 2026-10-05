# Curva de Carga para Condomínios — V2

Aplicação web em **Next.js + React + TypeScript** para apoiar estudos de infraestrutura de recarga de veículos elétricos em condomínios.

## Quatro módulos reais da V2

1. **Curva medida**
   - Importação CSV (`hora;demanda_kw`, `timestamp;demanda_kw` ou 24 valores).
   - Curva estimada apenas para estudo preliminar.
   - Indicadores: pico, média, mínima, energia diária equivalente, fator de carga e qualidade do dado.

2. **Simulação dos EVs**
   - Quantidade/potência dos carregadores.
   - Energia diária por veículo, simultaneidade, chegada e saída.
   - Cenário sem gerenciamento.
   - Load balancing e priorização fora de ponta.
   - Energia solicitada, atendida e não atendida.
   - Curva de 15 minutos e exportação CSV.

3. **Dimensionamento elétrico preliminar**
   - Corrente de projeto mono/bifásica ou trifásica.
   - Coordenação `Ib ≤ In ≤ Iz`.
   - Pré-seleção de cabo e disjuntor.
   - Fatores de temperatura e agrupamento.
   - Queda de tensão.
   - Condutor PE.
   - Verificação `Icu ≥ Icc disponível`.
   - Orientação de proteção diferencial em função da detecção CC do EVSE.

4. **Relatório técnico PDF**
   - Capa e identificação do projeto.
   - Origem/qualidade da curva.
   - Gráfico da curva de carga.
   - Simulação EV.
   - Memória de cálculo.
   - Cabos, disjuntores, queda de tensão, PE e Icu/Icc.
   - Recomendações, ressalvas e referências para validação.

## Execução local

```bash
npm install
npm run dev
```

Abra `http://localhost:3000`.

## Build de produção

```bash
npm run build
npm start
```

## Deploy na Vercel

1. Envie o projeto para um repositório no GitHub.
2. Na Vercel, escolha **Add New → Project**.
3. Importe o repositório.
4. Framework: **Next.js**.
5. Execute o deploy. Não há variáveis de ambiente nesta V2.

## Formato CSV

Exemplo simples:

```csv
hora;demanda_kw
0;28
1;26
2;25
...
23;34
```

Também é aceito `timestamp;demanda_kw`. Quando há vários dias, a V2 calcula o perfil horário pela média dos registros de cada hora e informa a quantidade de dias detectada.

Um modelo está disponível em `public/exemplo-curva-24h.csv`.

## Premissas de engenharia

O dimensionamento é **preliminar**. A tabela interna de capacidade de condução foi implementada de forma conservadora apenas para apoiar a seleção inicial. Antes de executar a instalação, o responsável técnico deve validar, na documentação vigente e aplicável:

- ABNT NBR 5410;
- ABNT NBR 17019;
- série ABNT NBR IEC 61851;
- NR-10;
- requisitos da distribuidora local;
- manual e datasheet do EVSE;
- método real de instalação, fatores de correção, queda de tensão, curto-circuito, seletividade, DR, DPS, aterramento e equipotencialização.

**Icu não é a corrente de curto-circuito da instalação.** A V2 compara a Icc disponível informada pelo projetista com o Icu do dispositivo informado.

## Tecnologias

- Next.js 15.5.27 (Maintenance LTS)
- React 19.1.5
- TypeScript
- jsPDF 4.2.1
- SVG nativo para gráficos interativos
- LocalStorage para persistência local do cenário


## V2.1 — correção do relatório PDF

Esta versão corrige a geração de relatórios no navegador e adiciona duas rotas de saída:

- **Baixar relatório técnico PDF**: gera o PDF no navegador e força o download por Blob.
- **Abrir versão imprimível / Salvar como PDF**: abre um relatório HTML completo em nova aba, com gráfico, tabelas e memória de cálculo, permitindo usar a opção nativa **Salvar como PDF** do navegador.

A interface também exibe mensagens de sucesso/erro quando o navegador bloquear downloads ou pop-ups.
