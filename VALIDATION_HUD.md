# Extensão HUD — verificação da candidata v0.3

## Adendo — correção dirigida da justificativa (25/10/2026)

A árvore local anterior não estava no caminho histórico desta sessão. A candidata foi recuperada do ZIP preservado, SHA-256 `647a4a3a7f0b117fd5972ec4c614b9fc53e43192cf37668bd7209e46cc6386b5`, e do patch `d53937900cfbf0a0ae03e41c7490e818f17f123295e99b655333de15b2ac175c`. Os 24 arquivos foram comparados byte a byte; a identidade original do commit `c5d570889921c83077cd2b9e8d6f1b5f7dfb84bb` foi restabelecida exatamente, preservando seu parent. Não houve reconstrução da ferramenta nem do catálogo privado.

O defeito era a validação apenas do tipo e tamanho da justificativa, aceitando string vazia em estados sem valor. Dois testes novos reproduziram a falha antes da correção (7 testes HUD aprovados, 2 falharam por ausência da rejeição esperada). Nenhuma expectativa anterior foi enfraquecida.

Correção localizada: `docs/hud.js` exige explicação não vazia em ABSENT, NOT_EVALUABLE e UNKNOWN, mantém VALUE com valor obrigatório e justificativa opcional, e revalida as leituras ao anexar/exportar. `docs/hud-storage.js` aplica a mesma validação antes da gravação. `docs/hud-app.js` aplica a política no formulário, identifica ouro/relógio na mensagem e bloqueia exportação de rascunho inválido. `docs/index.html` explicita a exigência. `HUD_REVIEW.md` atualiza as instruções. Os testes correspondentes ficam em `tests/hud.test.js` e `tests/browser/hud.browser.mjs`.

Verificações desta correção:

- `npm test`: **35/35 aprovados**, incluindo todos os 33 testes anteriores e a regressão C05, sem alterar seus arquivos de teste originais.
- Vazio, null, undefined e somente espaços rejeitados nos três estados e nos dois campos; justificativa válida preservada literalmente; valor não null rejeitado fora de VALUE; VALUE com justificativa vazia aceito.
- Chromium headless **134.0.6998.35**: 50 leituras sintéticas, dez controles, dez sessões, ZIP de **111.325.970 bytes**, retomada local e selo inicial preservados; zero erros de página e zero requisições HTTP externas.
- Na interface, as seis combinações de campo/estado recusam selagem e exportação com texto vazio ou somente espaços, sem avanço indevido.
- Um registro sintético legado inválido inserido no IndexedDB bloqueia exportação após retomada; comparação integral confirma que a tentativa não o reescreve. O teste restaura apenas sua própria fixture sintética para prosseguir a regressão. A aplicação não oferece essa alteração retroativa.
- Registros válidos continuam exportáveis; duplicatas e falha de gravação continuam recusadas. C05 continua acessível. `git diff --check` e sintaxe dos módulos verificados.

Não houve migração, exclusão ou revalidação retroativa automática de selos. Registros legados inválidos permanecem preservados e bloqueiam a exportação; eventual tratamento depende de decisão da OWNER. A exigência documental não certifica automaticamente a verdade da observação.

Branch local `fix/hud-required-justification`. Sem push, merge, alteração da main, publicação ou certificação real. O relatório abaixo preserva os resultados históricos da candidata anterior; a referência histórica a justificativas opcionais foi substituída pela regra deste adendo.

## Registro histórico da candidata c5d5708

Base inspecionada: `61e292e69c871440a6beff68e62c93fa03897af2` (main, v0.2). O inventário remoto continha aplicação estática, documentação e três arquivos de testes; nenhum AGENTS.md estava presente nessa árvore. Não houve acesso de desenvolvimento ao repositório principal Astra.

## Diagnóstico e alteração

A versão anterior aceitava exclusivamente C05 1280 × 576, lia todo o ZIP em memória e limitava sua entrada a 100 MB. O fluxo de caixas permanece com seu contrato v0.2. A extensão adiciona o fluxo HUD dentro da mesma página, com contrato separado de leitura humana, catálogo neutro privado, validação dos originais 813 × 366 e persistência local.

Geometria de exibição é compartilhada com o fluxo existente. PNG/CRC são reaproveitados do core. O leitor ZIP HUD usa acesso aleatório por Blob e não extrai outras entradas. Não há dependência de runtime, backend, serviço externo ou código de percepção da Astra.

## Verificações executadas com dados sintéticos

- `npm test`: **33 testes aprovados**, incluindo os **22 testes anteriores**, sem enfraquecer ou editar suas expectativas.
- `npm run test:browser`, com Playwright 1.51.1 e Chromium headless 134.0.6998.35: ensaio completo de **50 leituras sintéticas**, dez controles e dez grupos de sessão.
- ZIP sintético esparso de **111.325.970 bytes**, com PNG selecionado por índice e DEFLATE. Teste Node adicional registra menos de 70.000 bytes solicitados para índice/cabeçalho/membro de um arquivo maior que 111 MB; o método de leitura integral do arquivo é deliberadamente proibido nesse teste.
- Estados dos dois campos, VALUE com valor, demais estados com null; observações e justificativas opcionais; exposição anterior declarada sem falsa certificação de cegamento.
- JSON parcial e 50/50, identidade, hash, proveniência, autoridade provisória e ausência de promoção a GT.
- Persistência após recarregar, seleção renovada dos originais, selo inicial preservado e não reapresentação das respostas anteriores no formulário.
- Falha deliberada de gravação local: nenhum progresso indevido, rascunho mantido, nenhuma falsa confirmação de salvamento.
- Tentativa de duplicar a primeira leitura no armazenamento: rejeitada atomicamente.
- Reimportar o mesmo conjunto com JSON reformatado não permite criar outra primeira passagem.
- Cancelamento de navegação mantém o rascunho, inclusive ao tentar voltar a um caso selado.
- SHA-256 divergente desabilita a leitura. ZIP truncado, CRC inválido, identidades ambíguas, compressão não suportada, criptografia e declarações excessivas são recusados.
- Viewports de 393 × 851 e 851 × 393 sem transbordamento horizontal, zoom e enquadramento. Inspeção visual local de screenshot sintético; não é imagem da OWNER nem teste no POCO.
- Zero erros de página e zero requisições HTTP externas no ensaio. URLs blob locais são reconhecidas como referências em memória, não como transporte externo. CSP mantida sem `unsafe-eval` e com `connect-src 'none'`.
- `git diff --check` e verificação de sintaxe JavaScript.

O primeiro ensaio de tráfego identificou erroneamente URLs blob como externas; o classificador do teste foi corrigido para distinguir protocolos de rede. O mecanismo de espera do Playwright foi ajustado para respeitar a CSP, usando leitura de locators pelo harness em vez de avaliação de strings na página. Nenhuma proteção da aplicação foi relaxada. O navegador utilizado foi obtido para desenvolvimento isolado; não é distribuído com o site.

## Limites e aprovação

Não foram executados OCR, detector, treinamento, leitura automática de HUD ou certificação real. Capturas privadas não foram usadas nos testes. A preparação externa do catálogo privado é reconciliação de identidades; não é teste perceptual e não publica os dados.

O suporte à seleção dos 50 casos está demonstrado pelo contrato e pelo ensaio sintético. Os hashes dos originais reais ainda são conferidos pela aplicação, no momento em que a OWNER seleciona cada PNG local. Não se afirma certificação humana concluída ou compatibilidade física validada no POCO.

IndexedDB pode ser removido pelo navegador; exportação JSON privada regular é necessária. A interface não oferece edição retroativa ou importação de respostas anteriores. Esta decisão preserva o primeiro selo e evita introduzir respostas na primeira leitura; retificações futuras exigem procedimento próprio que preserve o registro original.

**Estado: extensão implementada e testada, candidata à aprovação da OWNER. Sem merge, deploy ou início de certificação real autorizado automaticamente.**

A entrega de código permanece na branch local `feat/hud-human-certification`. Não houve push, criação de PR ou publicação no repositório público. O pacote da candidata e o patch permitem revisão antes de qualquer envio remoto.
