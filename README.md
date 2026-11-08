# Caderno de Inglês

Aplicativo estático hospedado na Vercel. O chat com tutor usa a função serverless em `api/chat.js`.

## Ativar o tutor com IA

1. Crie uma chave de API na plataforma da OpenAI e mantenha-a privada.
2. No projeto da Vercel, abra **Settings → Environment Variables**.
3. Adicione `OPENAI_API_KEY` e selecione os ambientes **Production** e **Preview**.
4. Salve a variável e faça um novo deploy para ativar o chat.
5. Opcionalmente, defina `OPENAI_MODEL` para escolher outro modelo compatível com a API de chat da OpenAI. O padrão é `gpt-4o-mini`.

Nunca coloque a chave no HTML, no Git, no navegador ou em mensagens. As chamadas à IA podem gerar cobranças na conta do provedor. As mensagens enviadas ao tutor são processadas pela OpenAI; não use o chat para compartilhar dados sensíveis.

O endpoint limita rajadas de solicitações por endereço IP em cada instância da função. Como a Vercel pode executar várias instâncias, essa proteção não substitui um limite de gastos definido na conta da OpenAI. Configure um limite de gastos e monitore o uso da chave.

## Voz

O botão de microfone usa o reconhecimento de voz disponível no navegador e pede permissão de microfone. O recurso funciona melhor em navegadores baseados em Chromium. Se o reconhecimento não estiver disponível, é possível conversar digitando. A leitura das respostas usa a síntese de voz do navegador.
