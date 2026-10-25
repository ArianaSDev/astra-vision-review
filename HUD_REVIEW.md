# Revisão humana HUD — contrato e uso manual

Esta extensão pertence exclusivamente ao Astra Vision Review. Não executa OCR ou modelos e não escreve no repositório Astra. A OWNER realiza pessoalmente a leitura no aparelho; a ferramenta registra a evidência humana sem promover resultados ao GT.

## Preparação privada

Antes da certificação real, a OWNER precisa aprovar a extensão e sua publicação. Somente depois dessa aprovação:

1. Mantenha no aparelho o catálogo neutro privado e os ZIPs/PNGs originais autorizados. Não coloque esses arquivos no GitHub.
2. Abra o endereço HTTPS aprovado da ferramenta no Chrome Android. `file://` não é o fluxo suportado para módulos, SHA-256 ou persistência. No desenvolvimento, localhost é permitido.
3. Escolha **HUD · certificação humana OWNER**. Importe o catálogo privado de identidades. O seletor do catálogo permite todos os tipos de arquivo para não ocultar JSONs que o provedor Android identifica com outro MIME. Selecione o catálogo JSON sem renomeá-lo; conteúdo, estrutura e identidades continuam sendo validados antes de iniciar. Não selecione arquivos de OCR, previsões ou respostas anteriores.
4. Informe o aparelho e as condições da avaliação. Use **Iniciar primeira passagem local**. A revisão não exige afirmar cegamento ou independência inexistentes.
5. Selecione os ZIPs originais autorizados, inclusive o maior que 111 MB, ou selecione os PNGs locais. O seletor aceita múltiplos arquivos. Não selecione simultaneamente uma cópia PNG e um ZIP com a mesma entrada, pois isso torna a origem ambígua.

Work não possui autorização para acessar ou operar o POCO X7 Pro. Estas são instruções para execução manual exclusiva da OWNER.

## Leitura por caso

A aplicação verifica tamanho 813 × 366 e SHA-256 do PNG antes de mostrar a imagem. Um arquivo de nome semelhante ou hash divergente não habilita a leitura. Nenhuma imagem é redimensionada ou recodificada para exportação. A imagem completa pode ser enquadrada; arrastar move a visualização e dois dedos ou os botões alteram o zoom. **Ampliar área de visualização** aumenta a área do canvas. O zoom não altera bytes ou coordenadas do original.

Ouro e relógio têm estados separados:

| Estado | Registro |
|---|---|
| `VALUE` | Texto/valor lido manualmente; obrigatório e preservado literalmente. |
| `ABSENT` | Campo visualmente ausente; valor `null`. |
| `NOT_EVALUABLE` | A evidência não permite avaliar o campo; valor `null`. |
| `UNKNOWN` | Conclusão não estabelecida; valor `null`. |

Não existe estado padrão nem resposta esperada para gameplay ou controle. Observações são opcionais. A justificativa é obrigatória em ABSENT, NOT_EVALUABLE e UNKNOWN e opcional em VALUE; texto vazio ou somente espaços não atende à exigência. A mensagem de erro identifica ouro ou relógio. A ferramenta não normaliza valores, corrige texto ou decide o conteúdo dos pixels.

Declare a exposição anterior ao caso e confirme que não consultou OCR, previsões ou valores históricos durante a leitura. Conhecimento prévio é registrado; não invalida automaticamente a leitura humana da OWNER.

**Selar primeira leitura** grava os dois campos atomicamente no IndexedDB deste navegador/origem. Campos podem ser corrigidos antes de selar; a aplicação não registra cada tecla digitada. Depois do selo, não há edição nem substituição desse registro pela interface. Ao revisitar um caso selado, a aplicação informa sua existência sem reapresentar seus valores. O JSON exportado preserva a primeira leitura integral para fiscalização. Retificações posteriores exigem procedimento separado que mantenha o original; esta versão não fornece edição retroativa.

## Persistência e exportação

Use **Exportar JSON privado da passagem** regularmente, inclusive antes de fechar a página. A exportação revalida ouro e relógio de todas as leituras seladas. Registro legado inválido bloqueia a exportação sem modificar ou apagar o selo; seu tratamento exige decisão da OWNER, sem correção retroativa automática. Um rascunho preenchido e inválido também impede a exportação até sua correção ou descarte explícito. O JSON pode ser parcial e informa a contagem efetiva; só marca `complete:true` com 50 registros. Confira o arquivo no aplicativo Downloads/Arquivos do Android. Não envie o JSON ao GitHub.

Para continuar, abra o mesmo endereço no mesmo navegador e use **Retomar passagem local**. Selecione novamente os arquivos originais, pois imagens e ZIPs não são guardados no IndexedDB. Respostas anteriores não preenchem campos de um caso ainda não avaliado. Ao cancelar uma troca de caso, o rascunho atual é mantido.

IndexedDB é armazenamento local sujeito a quota, limpeza de dados, modo anônimo e políticas do navegador. Não é backup durável por si só. Falha de gravação não incrementa o progresso nem declara o caso selado; a leitura permanece disponível no formulário. Não existe envio, sincronização ou backend. A política CSP mantém `connect-src 'none'`; módulos e estilos são servidos pelo próprio site e imagens são blobs locais.

Um SHA-256 vincula bytes; não autentica a origem de uma captura nem torna o banco do navegador inviolável. O selo por leitura é um hash de seu JSON antes da inclusão de `readingSha256`, para comparação posterior. A exportação não é assinatura digital, certificação automática ou alteração de GT.

## Catálogo neutro de entrada

Formato `astra-hud-catalog/1`, com exatamente as chaves `schema`, `datasetId` e `cases`. Cada caso aceita somente:

- `captureId`: identificador completo do sidecar/manifesto original.
- `sessionId`: identificador completo da sessão física.
- `filename`: basename original do PNG.
- `sha256`: SHA-256 completo dos bytes originais, em hexadecimal minúsculo.
- `kind`: `gameplay` ou `control` segundo a seleção já autorizada.
- `zipEntry`: caminho exato opcional dentro do ZIP, para desambiguar nomes.

O catálogo deve conter 50 captureIds e hashes únicos, 40 gameplay e dez controles, em dez sessões com quatro gameplay e um controle cada. A ferramenta preserva essa correlação e não declara 40 partidas independentes. O catálogo não pode carregar valores HUD, previsões, respostas, notas de avaliadores ou campos adicionais. A validação de estrutura não substitui a autoridade da OWNER sobre a seleção. Catálogo maior que 256 KiB é recusado.

O catálogo real e seu recibo de proveniência são entregues privadamente, fora deste repositório. O projeto não inclui nenhuma lista real de captureIds, hashes de capturas, imagens ou avaliações humanas. Prefixos de IDs não são usados como identidades definitivas.

## Limites de ZIP e memória

O leitor utiliza o índice do ZIP para selecionar somente o PNG autorizado. Entradas JSON, RGBA ou outras imagens não são extraídas. Um `File`/`Blob` selecionado não implica ler seus bytes integralmente. A cauda tem no máximo 65.557 bytes; o diretório, até 8 MiB. Um PNG descompactado tem no máximo 20 MiB e seu CRC é conferido antes do hash. PNGs são decodificados um por vez; a imagem anterior deixa de ser referenciada ao trocar o caso. A memória real do navegador não é declarada como quota física.

ZIP64, arquivos multipartes, criptografia, compressões diferentes de STORED/DEFLATE e identidades ambíguas são recusados. A alternativa é a OWNER extrair manualmente os PNGs autorizados no próprio aparelho. Não existem upload, extração automática no filesystem ou importação de resultados históricos.

## Desenvolvimento e aprovação

Somente dados sintéticos nos testes. A validação automática não é certificação dos casos reais e não substitui a verificação física manual da OWNER. O fluxo C05 mantém revisão de caixas, IGNORE, conferência, zoom, desfazer e exportação v0.2. Não há integração com a Astra, Brain, PR #322 ou GT. Merge, publicação e certificação real exigem aprovação posterior.
