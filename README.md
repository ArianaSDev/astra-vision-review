# ASTRA Vision Review

Interface independente para primeira revisão cega de C05. Processamento exclusivamente no navegador, sem telemetria, serviços de upload, CDN, detector ou armazenamento de respostas. Este repositório contém somente código e testes sintéticos; não contém imagens ou dados do projeto Astra.

## Uso no celular

1. Abra o site HTTPS e selecione R1, R2, R3 ou TEST.
2. Em **Abrir PNG ou ZIP local**, use o seletor de arquivos do aparelho para selecionar `C05_frame_23835.png` ou `Kagura_Cenas_Candidatas.zip`. A imagem deve ter exatamente 1280 × 576. O PNG é decodificado localmente e seu SHA-256 é calculado sobre os bytes originais.
3. Desenhe **Corpo visível** ou **IGNORE** arrastando um dedo. Use dois dedos para zoom/movimento ou os botões de zoom. Em **Ajustar**, selecione a caixa, arraste o centro ou um canto. Os campos numéricos permitem ajuste fino em pixels originais.
4. Confirme limites sustentados ou aproximados. Não extrapole partes ocultas; registre ambiguidades nas observações. IGNORE serve para exclusões/distratores, nunca como classe de personagem.
5. Informe cobertura, observações e confirmação de independência. Exporte um JSON local. No iPhone, confira Downloads no app Arquivos.

Trocar de revisor limpa caixas, cobertura e observações. A página não carrega anotações anteriores, propostas de IA nem revisões de outras pessoas. Não existe backend. Fechar/recarregar a página perde dados não exportados.

## Formato e autoridade

JSON `astra-vision-review/0.1`: cena, revisor, SHA-256, bytes do PNG, resolução, origem local, caminho da entrada ZIP, caixas `xywh` e `xyxy`, certeza dos limites, cobertura e observações. Coordenadas têm origem no canto superior esquerdo da imagem original. Identificadores B1… são apenas IDs locais de regiões, não identidades de personagens. Nenhum `heroId` ou `entityId` é produzido.

Toda exportação é `provisional_unvalidated`, `canonicalGroundTruth:false`. Não é GT locked nem referência definitiva para métricas. Revisão humana independente é necessária. O índice de frame e timestamp de C05 são metadados da cena fornecidos, não verificação independente do vídeo. Um PNG com nome correto e resolução correta ainda requer confirmação humana de seu conteúdo.

## ZIP e limites

Somente a entrada com basename exato `C05_frame_23835.png` é utilizada; nenhuma proposta ou manifesto é importado. Duplicatas são rejeitadas. Suporte a ZIP STORED e DEFLATE com `DecompressionStream('deflate-raw')`; navegadores sem essa API recebem orientação para abrir o PNG extraído no próprio aparelho. ZIP64, multipartes e criptografados não são suportados. Limite de entrada 100 MB e PNG 20 MB; CRC-32 da entrada ZIP é verificado. Nenhuma recodificação é feita.

## Desenvolvimento e publicação

Sem dependências de runtime ou instalação. `node --test tests/*.test.js` executa testes locais sintéticos. Sirva `docs/` por HTTP localhost para desenvolvimento ou HTTPS para uso real; abrir o HTML via `file://` não é o fluxo suportado para módulos/SHA-256.

GitHub Pages: Settings → Pages → **Deploy from a branch**, branch **main**, pasta **/docs**. A pasta `docs/` contém o site final. Os testes e documentação ficam fora do site publicado. Não envie imagens, ZIPs ou resultados de revisões ao repositório. `.gitignore` é uma prevenção adicional, não um controle de confidencialidade.

## Validação

Testes verificam importação PNG, importação ZIP STORED/DEFLATE, CRC e rejeições, transformação de coordenadas sob zoom/movimento, limites de caixas e exportação individual provisória. Testes de interação usam DOM/canvas simulados; não substituem testes nos aparelhos. Compatibilidade real em Chrome Android e Safari iPhone deve ser confirmada nesses dispositivos. Não se afirma desempenho de detector ou tracking.
