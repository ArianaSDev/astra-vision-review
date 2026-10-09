# ASTRA Vision Review

Interface independente para primeira revisão cega de C05. Processamento exclusivamente no navegador, sem telemetria, serviços de upload, CDN, detector ou armazenamento de respostas. Este repositório contém somente código e testes sintéticos; não contém imagens ou dados do projeto Astra.

## Uso no celular

1. Abra o site HTTPS e selecione R1, R2, R3 ou TEST.
2. Em **Abrir PNG ou ZIP local**, use o seletor de arquivos do aparelho para selecionar `C05_frame_23835.png` ou `Kagura_Cenas_Candidatas.zip`. A imagem deve ter exatamente 1280 × 576. O PNG é decodificado localmente e seu SHA-256 é calculado sobre os bytes originais.
3. Desenhe **Corpo visível** ou **IGNORE** arrastando um dedo. Use dois dedos para zoom/movimento ou os botões de zoom. Em **Ajustar**, selecione a caixa, arraste o centro ou um canto. Os campos numéricos permitem ajuste fino em pixels originais.
4. Confirme limites sustentados ou aproximados. Não extrapole partes ocultas; registre ambiguidades nas observações. IGNORE serve para exclusões/distratores, nunca como classe de personagem.
5. Use **Conferir caixas** para examinar cada região ampliada junto à cena inteira. Escolha manter, ajustar ou registrar limites não determináveis. Inclua IGNORE. Ajustes tornam apenas a região alterada pendente; confira-a novamente. Com zero caixas, confirme explicitamente o exame da cena.
6. Informe cobertura, observações e confirmação de independência. Exporte um JSON local. No iPhone, confira Downloads no app Arquivos.

Trocar de revisor limpa caixas, cobertura e observações. A página não carrega anotações anteriores, propostas de IA nem revisões de outras pessoas. Não existe backend. Fechar/recarregar a página perde dados não exportados.

## Formato e autoridade

JSON `astra-vision-review/0.2`: cena, revisor, SHA-256, bytes do PNG, resolução, origem local, caminho da entrada ZIP, caixas `xywh` e `xyxy`, certeza dos limites, cobertura e observações. Coordenadas têm origem no canto superior esquerdo da imagem original. Identificadores B1… são apenas IDs locais de regiões, não identidades de personagens. Nenhum `heroId` ou `entityId` é produzido.

Toda exportação é `provisional_unvalidated`, `canonicalGroundTruth:false`. Não é GT locked nem referência definitiva para métricas. Revisão humana independente é necessária. O índice de frame e timestamp de C05 são metadados da cena fornecidos, não verificação independente do vídeo. Um PNG com nome correto e resolução correta ainda requer confirmação humana de seu conteúdo.

## ZIP e limites

Somente a entrada com basename exato `C05_frame_23835.png` é utilizada; nenhuma proposta ou manifesto é importado. Duplicatas são rejeitadas. Suporte a ZIP STORED e DEFLATE com `DecompressionStream('deflate-raw')`; navegadores sem essa API recebem orientação para abrir o PNG extraído no próprio aparelho. ZIP64, multipartes e criptografados não são suportados. Limite de entrada 100 MB e PNG 20 MB; CRC-32 da entrada ZIP é verificado. Nenhuma recodificação é feita.

## Desenvolvimento e publicação

Sem dependências de runtime ou instalação. `node --test tests/*.test.js` executa testes locais sintéticos. Sirva `docs/` por HTTP localhost para desenvolvimento ou HTTPS para uso real; abrir o HTML via `file://` não é o fluxo suportado para módulos/SHA-256.

GitHub Pages: Settings → Pages → **Deploy from a branch**, branch **main**, pasta **/docs**. A pasta `docs/` contém o site final. Os testes e documentação ficam fora do site publicado. Não envie imagens, ZIPs ou resultados de revisões ao repositório. `.gitignore` é uma prevenção adicional, não um controle de confidencialidade.

## Validação

Testes verificam importação PNG, importação ZIP STORED/DEFLATE, CRC e rejeições, transformação de coordenadas sob zoom/movimento, limites de caixas e exportação individual provisória. Testes de interação usam DOM/canvas simulados; não substituem testes nos aparelhos. Compatibilidade real em Chrome Android e Safari iPhone deve ser confirmada nesses dispositivos. Não se afirma desempenho de detector ou tracking.

## Conferência individual v0.2

Cada caixa tem `conference` com status, decisão `keep` ou `indeterminate`, revisor, instante e assinatura dos atributos atuais da região. A assinatura é uma comparação exata de estado, não uma métrica de qualidade. Alterar coordenadas, certeza ou observação invalida a conferência apenas daquela caixa. Escolher **Ajustar a caixa** também a torna pendente e ativa a ferramenta Ajustar; **Conferir caixas** abre sua nova conferência. Desfazer não revalida regiões restauradas/alteradas e preserva a conferência atual das demais.

O campo `conference` geral registra conclusão, contagens e IDs das regiões indetermináveis. Com zero caixas, `emptySceneExamined:true` requer confirmação explícita na interface; não equivale a ausência comprovada de personagens. Todas as regiões, inclusive IGNORE, devem ser conferidas.

Os campos v0.1 de identidade da cena, revisor, origem, hash, geometria, cobertura, observações e autoridade mantêm seu significado. `certainty` continua sendo a classificação informada durante a edição; a decisão de conferência é registrada separadamente e não transforma `approximate` em `supported`. `indeterminate` declara que o limite não é uma referência confiável, mesmo quando a revisão está completa. Revisões v0.1 já exportadas não são importadas nem alteradas. Conferência individual não é adjudicação independente, GT validado ou resultado de detector.

A imagem original é apenas desenhada no canvas: recorte contextual e cena inteira não alteram seus bytes ou as coordenadas. O espaçamento do recorte serve exclusivamente à exibição de contexto; não sugere tamanho de caixa ou resposta. Não há referência automática, comparação com outros revisores, correção por IA ou rótulo de acerto.

### Validação desta alteração

22 testes automatizados: os nove casos anteriores (adaptados apenas à nova conferência obrigatória) e 13 casos adicionais, cobrindo gate individual, IGNORE, indeterminável, ajustes numéricos/ponteiro, desfazer, zero caixas, troca de revisor, coordenadas, contexto e JSON v0.2. DOM/canvas simulados não comprovam gestos em dispositivos físicos.

### Entrega isolada

Branch `feat/pre-export-neutral-box-review`, baseada em `99c447b74d4564245b188c490439dd3fec751928`. Não atualizar main nem GitHub Pages enquanto R1 estiver revisando. O merge e a publicação da v0.2 exigem autorização posterior.
