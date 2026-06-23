# Simulador Sabre GDS · Treino de Comandos

Um simulador offline para treinar os comandos crípticos do **Sabre GDS**, o sistema de reservas usado por agências de viagens. Roda em um único arquivo HTML, sem instalação, sem dependências e sem conexão com nenhum sistema real.

> **Por que existe?** O Sabre fica atrás de credenciais de agência (PCC), então não há um "playground" público para praticar. Este projeto preenche essa lacuna: você treina a digitação e o encadeamento dos comandos sem precisar de acesso ao sistema real.

## ✨ Funcionalidades

- **3 modos de treino**
  - **Praticar** — você digita o comando; o sistema corrige e explica cada um.
  - **Flashcard** — vê a tarefa, tenta de cabeça e revela a resposta.
  - **PNR completo** — monta reservas inteiras em sequência (do voo ao localizador), como num teste prático de contratação.
- **Exercícios dinâmicos** — disponibilidade, venda, assentos e cancelamentos sorteiam cidades, datas, classes e segmentos a cada rodada. Você aprende o *padrão*, não a resposta decorada.
- **Placar por módulo** — ao final, mostra sua precisão em cada categoria, do ponto mais fraco ao mais forte, para você saber o que revisar.
- **Ficha + checklist no modo PNR** — dados da reserva sempre visíveis e os 7 passos marcados conforme você acerta, com geração de localizador no final.
- **Visual de terminal GDS** — estética monoespaçada para você se acostumar com a cara real do sistema.

## 🧩 Módulos cobertos

| Módulo | Exemplos de comando |
|---|---|
| Sessão (login/logout) | `SI`, `SO`, `I`, `IR` |
| Disponibilidade de voos | `115JUNGRUMIA` |
| Venda de assentos | `01Y1` |
| PNR (montar reserva) | `-RAMOS/QUEILA MS`, `9GRU555-1234-A`, `6P`, `7TAW/`, `ER` |
| Recuperar / Visualizar | `*ABCDEF`, `*-RAMOS`, `*A`, `*I`, `*P9` |
| Tarifação | `WP`, `WPNC`, `FQGRUMIA` |
| Assentos (seat map) | `4G1` |
| Serviços especiais (SSR) | `3VGML1`, `3WCHR1`, `3UMNR1` |
| Observações (Remarks / OSI) | `5...`, `3OSI AA VIP` |
| Itinerário (cancelar/alterar) | `X2`, `XI` |
| Encode / Decode | `W/*AA`, `W/-CCRIO DE JANEIRO` |
| Filas (Queues) | `QC`, `Q/1` |
| Histórico e divisão | `*H`, `D1` |

## 🚀 Como usar

Não precisa de servidor nem build. Basta abrir o arquivo:

```bash
# clone o repositório
git clone https://github.com/felipewilliam2/simulador-sabre.git
cd simulador-sabre

# abra no navegador
open index.html        # macOS
# xdg-open index.html  # Linux
# start index.html     # Windows
```

Ou simplesmente dê dois cliques no `index.html`.

## ⚠️ Aviso importante

- Este é um **ambiente de treino**. Ele **não conecta** ao Sabre real e não cria reservas de verdade.
- Os formatos são baseados em entradas reais do Sabre, mas **podem variar conforme a configuração de cada agência**. Sempre confirme no **Format Finder** quando tiver acesso ao sistema oficial.
- Os códigos de serviço especial (SSR: `VGML`, `WCHR`, `UMNR`...) seguem o padrão **IATA**, válido para qualquer GDS.
- No mercado brasileiro, o **Amadeus** é mais comum que o Sabre — a lógica de comandos crípticos é parecida, e treinar um ajuda a entender o outro.

## 🛠️ Tecnologia

HTML, CSS e JavaScript puro (vanilla), em um único arquivo. Sem frameworks, sem dependências, 100% offline.

## 🗺️ Próximos passos (ideias)

- Versão Amadeus dos comandos, lado a lado.
- Salvar histórico das sessões no navegador (localStorage) para acompanhar a evolução.
- Exportar um cartão de referência imprimível com todos os comandos.

## 📄 Licença

[MIT](LICENSE) © 2026 Felipe Williams
