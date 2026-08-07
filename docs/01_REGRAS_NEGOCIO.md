# 01. Regras de Negócio MK9

## 1. Regra KING (Janela Operacional)
A Indústria KING não utiliza o mês civil padrão. Sua competência é definida por um ciclo dinâmico, geralmente do dia **23 do mês anterior até o dia 22 do mês atual**.
- O sistema detecta automaticamente se a indústria possui a flag `CUSTOM_CYCLE`.
- O motor `resolveWindow` calcula as datas reais de início e fim para filtragem de visitas e metas.

## 2. Frequência Versionada
A frequência (visitas contratadas) é a fonte da verdade para o cálculo de produtividade.
- **Vigência**: Cada alteração de frequência gera uma nova versão com `valid_from`.
- **Proporcionalidade**: Se uma frequência muda no meio do mês, o sistema calcula a meta proporcional aos dias de vigência de cada regra.
- **Prioridade**: Frequência manual (ajuste direto) tem precedência sobre a frequência importada via Excel.

## 3. Contratadas vs Realizadas
- **Contratadas**: Soma da frequência das lojas vinculadas à indústria no período.
- **Realizadas**: Visitas com status `completed` dentro da janela operacional.
- **Regra de Ouro**: `Contratadas = Realizadas + Pendentes + Extras`.

## 4. Substituição de Competência
Toda importação de checklist substitui integralmente a importação anterior da mesma indústria e competência (mês/ano).
- A importação antiga é marcada como `superseded`.
- As visitas da importação antiga são removidas para evitar duplicidade.
