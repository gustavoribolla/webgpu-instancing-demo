# GPU Instancing — WebGPU/WGSL

Demonstração para Computação Gráfica — Insper. Gustavo Colombi Ribolla e Luigi Orlandi Quinze.

## Executar

Use Chrome ou Edge atualizado, com WebGPU e aceleração gráfica disponíveis. Não precisa de npm ou bibliotecas externas. Abra o terminal na pasta do projeto:

```sh
python -m http.server 8000
```

Acesse http://localhost:8000. Não abra o HTML por duplo clique. Em macOS/Linux, pode ser necessário `python3`. Caso a porta esteja ocupada, use 8001.

## Funcionamento

Uma malha de cubo (24 vértices com normais por face, 36 índices, 12 triângulos) é criada uma vez. O compute shader `generate.wgsl` preenche um storage buffer com posição, altura, cor e rotação por instância diretamente na GPU, quando a quantidade muda. O vertex shader `shader.wgsl` usa `@builtin(instance_index)` para recuperar os atributos e transformar o vértice. O fragment shader aplica iluminação simples.

- Tradicional: N chamadas `drawIndexed(indexCount, 1, 0, 0, i)`. O quinto argumento, firstInstance, seleciona o registro da instância.
- Instanciado: uma chamada `drawIndexed(indexCount, N)`.

Ambos os modos compartilham a malha, o material, os dados e o pipeline. A comparação isola a quantidade de chamadas; não há duplicação de vértices no modo tradicional. A geração por compute shader não é uma draw call.

## Demonstração (45–60 segundos)

1. Selecione 1.000 objetos e pause a câmera.
2. Modo tradicional: 1.000 draw calls, 12.000 triângulos submetidos.
3. Modo instanciado: 1 draw call, mesmos 12.000 triângulos, mesma imagem.
4. Aumente para 5.000 ou 10.000 objetos e compare as médias de codificação CPU após estabilizarem.
5. Explique que reduzir draw calls não significa reduzir o número de triângulos na mesma proporção, nem garante aumento de FPS.

## Métricas

- Draw calls: contagem exata de chamadas de desenho no render pass.
- Triângulos: 12 × N submetidos, não necessariamente visíveis após culling.
- Codificação CPU: média móvel de até 60 quadros do tempo de criação, codificação e finalização do render pass, excluindo queue.submit e compute pass. Não mede o tempo de execução na GPU.
- FPS observado: média dos intervalos de requestAnimationFrame, limitada pelo navegador, taxa de atualização e hardware. Não é um benchmark controlado; pode oscilar e não há ganhos de desempenho pré-definidos.

## Arquivos

- `index.html` / `style.css`: interface e controles.
- `main.js`: inicialização, buffers, pipeline, câmera e comparação.
- `generate.wgsl`: compute shader de geração de atributos.
- `shader.wgsl`: vertex e fragment shaders.

## Referências

- https://developer.mozilla.org/en-US/docs/Web/API/GPURenderPassEncoder/drawIndexed
- https://www.w3.org/TR/webgpu/
- https://www.w3.org/TR/WGSL/
