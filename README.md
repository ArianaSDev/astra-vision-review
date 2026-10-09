# ASTRA Vision Review

Interface estática independente para revisão cega de uma cena por sessão. Processamento local no navegador, sem telemetria, upload, backend, CDN, detector ou armazenamento de respostas. O repositório contém somente código genérico e fixtures públicas sintéticas.

## Uso no celular

1. Abra a versão autorizada por HTTPS e escolha R1, R2, R3 ou TEST.
2. Abra um **manifesto local** preparado e conferido em ambiente privado. Selecione uma cena. O site não fornece uma fila privada embutida.
3. Abra o PNG cujo nome corresponde à cena ou um ZIP contendo seu caminho exato. Tamanho, resolução e SHA-256 dos bytes originais devem corresponder ao manifesto. O navegador também decodifica o PNG; não há recodificação.
4. Desenhe **Corpo visível** ou **IGNORE** arrastando um dedo. Use dois dedos ou os botões para zoom/movimento. Em **Ajustar**, arraste o centro/canto ou aplique campos numéricos em pixels originais. IGNORE é exclusão/distrator, nunca classe de personagem.
5. Registre limites sustentados ou aproximados e incertezas sem extrapolar partes ocultas. Use **Conferir caixas** para examinar cada região ampliada com contexto e a cena inteira. Escolha manter, ajustar ou limites não determináveis. Todas as regiões, incluindo IGNORE, precisam de conferência.
6. Declare cobertura completa, parcial ou inadequada, observações e independência. Com zero caixas, confirme explicitamente o exame da cena. Exporte um JSON local individual; confira Downloads/Arquivos no aparelho.

Trocar cena, revisor, manifesto ou imagem solicita descarte quando houver estado não exportado, incluindo cobertura, confirmações, observações e campos de ajuste ainda não aplicados. Trocar cena limpa imagem e anotações; trocar revisor preserva somente a imagem verificada e limpa a revisão. Uma operação assíncrona cancelada não instala seus resultados posteriormente. Não há importação de respostas, propostas de IA ou revisão de outras pessoas. Recarregar/fechar perde o estado; o aviso de saída depende do suporte do navegador. A geração do download não comprova que o aparelho salvou o arquivo.

## Manifesto local estrito

Schema `astra-vision-review-manifest/0.1`. Somente os campos abaixo são aceitos; campos extras ou ausentes são rejeitados, inclusive bounding boxes, propostas, revisões e GT. Não publique manifestos reais neste repositório. O formato mínimo é:

```text
{ schema: "astra-vision-review-manifest/0.1", scenes: [
  { id, pngPath, width, height, pngBytes, sha256,
    frameIndex, timestampSeconds, timestamp, timingAuthority, limitations }
] }
```

| Campo | Tipo e regra |
|---|---|
| `scenes` | Array de 1–64 cenas; IDs, caminhos e basenames únicos |
| `id` | String ASCII de 1–64 caracteres: letra/dígito inicial, depois letra/dígito/`_`/`-` |
| `pngPath` | Caminho relativo exato, até 512 caracteres, ASCII letra/dígito/`_`/`-`/`.`/`/`, extensão `.png`; sem `/` inicial, segmentos vazios, `.` ou `..`, barra invertida ou URL |
| `width`, `height` | Inteiros positivos até 4096, sistema original de coordenadas |
| `pngBytes` | Inteiro de 33 a 20 MiB, tamanho esperado dos bytes originais |
| `sha256` | String de 64 caracteres hexadecimais minúsculos, calculada do PNG real |
| `frameIndex` | Inteiro seguro não negativo, declarado pela fonte |
| `timestampSeconds` | Número finito não negativo, equivalente ao timestamp textual |
| `timestamp` | String `HH:MM:SS.mmm`, horas de 2–6 dígitos, minutos/segundos 00–59 |
| `timingAuthority` | String não vazia, até 1000 caracteres, sem controles |
| `limitations` | Array de 1–20 strings não vazias, até 1000 caracteres cada, sem controles |

Limite de manifesto: 1 MiB. Esses limites são de recursos/formato, não limiares de qualidade de anotação. O aplicativo calcula também SHA-256 dos bytes do manifesto para a proveniência. A correspondência de hash identifica bytes; não autentica autoria nem comprova temporalidade. Não se deduz FPS a partir de `frameIndex`. Metadados temporais e limitações são declarações da fonte local e precisam de autoridade externa apropriada.

## ZIP e segurança

Somente a entrada com **caminho completo exato** declarado é extraída; não se substitui por outro basename. Não se lê conteúdo de propostas ou revisões presentes no ZIP. Duplicatas da entrada, cabeçalhos inconsistentes, CRC-32 incorreto e tamanhos incompatíveis são rejeitados. Suporte a STORED e DEFLATE via `DecompressionStream('deflate-raw')`, com limite de descompressão; quando indisponível, abra o PNG extraído no próprio aparelho. ZIP64, multipartes, criptografados e outros métodos não são suportados. Arquivo até 100 MiB e PNG até 20 MiB.

CSP mantém `connect-src 'none'`, scripts/estilos locais, imagens locais/blob, `object-src 'none'`, `base-uri 'none'` e `form-action 'none'`. A carga usa `File.arrayBuffer`, WebCrypto, Blob e Image locais. A exportação usa um download Blob; não faz requisição remota. Campos são mostrados com `textContent`. Não há persistência de revisão em cookies/storage. O carregamento inicial do código estático usa a hospedagem; os bytes dos arquivos selecionados e suas revisões não são enviados por este código. `.gitignore` é prevenção adicional, não controle de confidencialidade.

## Exportação v0.3 e compatibilidade documental

Schema novo **`astra-vision-review/0.3`**. Identidade da cena, resolução, frame e timestamp passam a vir do manifesto local. `session` vincula cena, SHA-256 do PNG e revisor; `manifestSource` registra nome, tamanho, SHA-256 e schema do manifesto. `source` inclui cena, container PNG/ZIP e entrada exata. O nome é `review-<sceneId>-<reviewer>-<instante>.json`.

Os significados v0.1/v0.2 de revisor, origem, hash, geometria, cobertura e observações são preservados. `xywh` e `xyxy` continuam em pixels originais, origem no canto superior esquerdo. IDs B1… identificam apenas regiões locais. Nenhum heroId/entityId é atribuído. Exportações anteriores, adjudicações e comparações não são importadas, migradas ou modificadas; não recebem conferência retroativa. A fila é exclusivamente a seleção explícita do manifesto, sem reinclusão automática de cenas históricas.

Conferência v0.2 preservada: decisão `keep`/`indeterminate`, revisor, instante e assinatura exata dos atributos da região. Alterar geometria, certeza ou nota invalida somente aquela conferência. Ajustar também invalida; undo não ressuscita conferência da região restaurada/alterada. `certainty` não é promovida de `approximate` a `supported`. `indeterminate` não é referência confiável de limites. Zero caixas exige `emptySceneExamined:true`, que não prova ausência absoluta de personagens.

Toda exportação é `provisional_unvalidated`, `canonicalGroundTruth:false`, `trainingAuthorized:false`. Conferência não equivale a adjudicação independente, GT canônico, prontidão de treinamento ou resultado de detector. Consumidores devem reconhecer explicitamente o schema 0.3; não se alega compatibilidade com contratos internos não verificados.

## Desenvolvimento e validação

Sem dependências de runtime ou instalação. Execute `npm test` ou `node --test tests/*.test.js`. Sirva `docs/` em HTTPS ou localhost; `file://` não é fluxo suportado para módulos e SHA-256. Os testes sintéticos cobrem os 22 casos anteriores, agora parametrizados, e os casos multicena: manifesto estrito, PNG/hash, ZIP/CRC/limites, geometria, isolamento, estado pendente, concorrência, exportação e controles locais. Fixtures de cabeçalho PNG e DOM/canvas/Image simulados testam lógica; não comprovam renderização, decodificação real no aparelho ou suporte físico a gestos.

## Gate manual — POCO X7 Pro

Usar **TEST**, nunca iniciar revisão humana durante este gate. Somente após disponibilização de uma prévia aprovada, sem trocar main/Pages:

1. Carregar manifesto local válido; conferir lista de cenas. Rejeitar manifesto com campo extra de anotação e manifesto com tipo/timestamp inválido.
2. Selecionar duas cenas diferentes, abrir cada PNG e o mesmo ZIP, verificar SHA-256/resolução/proveniência. Rejeitar PNG de outra cena e ZIP com entrada errada/duplicada/CRC inválido (fixtures sintéticas para testes negativos).
3. Desenhar corpo e IGNORE, pinçar/mover, ajustar pelo dedo/campo, excluir e desfazer. Conferir que coordenadas permanecem originais e limites dentro da imagem.
4. Conferir todas as regiões; verificar bloqueio antes da última. Manter uma aproximada e registrar outra indeterminável. Ajustar somente uma e confirmar que apenas ela exige nova conferência.
5. Exportar com cobertura parcial; inspecionar schema, cena, hash, revisor, xywh/xyxy, conferências e autoridade provisória. Não publicar o JSON.
6. Alterar isoladamente cobertura, observações, confirmação de independência, confirmação zero caixas e um campo de ajuste sem aplicar. Tentar troca de cena/revisor/arquivo: cancelar preserva; aceitar descarta. Conferir ausência de dados do revisor anterior.
7. Trocar cena ou revisor enquanto PNG/ZIP/manifesto carrega; verificar que resultado antigo não reaparece. Testar falha de importação e novo arquivo válido.
8. Fazer zero caixas, declarar cobertura completa/parcial/inadequada e confirmar exame explícito; exportação deve funcionar somente após confirmações.
9. Confirmar arquivo baixado no aparelho e comparar bindings de duas exportações de cenas diferentes. Conferir ausência de requisições de upload/telemetria nos caminhos de leitura e exportação, quando inspeção de rede estiver disponível.

Registrar navegador/versão, orientação da tela e qualquer falha. Safari iPhone é um teste separado ainda necessário. Este PR permanece DRAFT: nenhum merge, alteração de configuração Pages, nova publicação ou gate físico é presumido a partir dos testes automatizados.
