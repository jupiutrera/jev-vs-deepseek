# Control de seguridad · DeepSeek vs Jev

Demo visual para vídeo: dos controles de seguridad de aeropuerto idénticos reciben el mismo equipaje,
en el mismo instante y con el mismo reglamento. Cada agente lee el parte de rayos X y decide
**PASA**, **REVISAR**, **RETIRAR** o **ALERTA** antes de que la bandeja llegue al final de la cinta;
si no decide a tiempo, cae al carro de **SIN DECIDIR**.

| Mostrador | Agente | Monigote |
| --- | --- | --- |
| Izquierdo | **DeepSeek** (LLM tradicional; salida JSON restringida a las cuatro decisiones) | Ballena azul |
| Derecho | **Jev** (TypeSafe AI; una pregunta `choice` con las cuatro decisiones como salida tipada) | Monigote naranja |


## Arrancar (Docker)

```bash
cp .env.example .env      # rellenar la clave de Jev y la del LLM
docker compose up -d --build
```

Abrir http://localhost:5173. Sin Docker: `npm install && npm run dev`.

Las claves sólo viven en el servidor de Vite, que hace de proxy (`/api/jev`, `/api/llm`) y **mide
la latencia en el propio servidor**, desde que sale la petición hasta que llega la respuesta.

## Parámetros de URL

| Parámetro | Efecto |
| --- | --- |
| `?mock` | Agentes simulados, sin llamadas a la API. La pantalla lo indica siempre |
| `?seed=123` | Semilla fija de la secuencia de equipajes |
| `?mode=precision` | Modo precisión: 40 equipajes sin límite de tiempo |
| `?autostart` | Empieza sin pulsar ESPACIO |
| `?desde=3` | Empieza en la fase 3 (para ensayar) |
| `?ritmo=1.5` | Fuerza el ritmo de las fases (por defecto depende del razonamiento del LLM) |
| `?keys` | Muestra los atajos de teclado en pantalla |
| `?muted` | Empieza sin sonido |

## Controles

`ESPACIO` empezar/pausa · `M` cambiar modo · `N` nueva semilla · `R` reiniciar ·
`S` guardar el registro de la partida (JSON) · `A` sonido sí/no

## Cómo se juega

- **Procesamiento secuencial**: cada agente atiende una bandeja a la vez. Coge la más antigua que
  todavía puede decidir con margen (el percentil 80 de su propia latencia reciente) y, si ninguna le da
  tiempo, espera a la siguiente; así el agente lento no pierde el tiempo con bandejas que van a caer (es su mejor
  estrategia, no la peor).
- Si la bandeja llega al final mientras el agente la lee, la llamada se abandona (se corta
  también hacia la API) y se le apunta el coste estimado de la entrada.
- **Precisión con tiempo**: al terminar, cada mostrador decide sin prisa (6 llamadas en paralelo, `HINDSIGHT_CONCURRENCY` en `src/config.ts`) las bandejas que se le cayeron. Mientras tanto la pantalla dice "CARGANDO LAS ESTADÍSTICAS…" con el progreso; después, los resultados muestran cuánto habría acertado decidiéndolas todas ("PRECISIÓN CON TIEMPO"). Se lanza al final y no durante la partida para no frenar las llamadas de verdad. No cuenta en puntos, pero sí en el coste y en el coste por llamada (son llamadas que se pagan); queda en el registro (`hindsight`) y el vídeo espera a que termine (máximo 60 s).
- Puntos: acierto +10, error −5, dejar pasar algo que era alerta −25. Una bandeja sin decidir no
  suma ni resta: sólo restan los errores.
- Cuatro fases de 45 s: una bandeja cada 2,0 / 0,9 / 0,6 / 0,4 s, con 3,0 / 1,8 / 1,3 / 1,0 s de cinta,
  calibradas con latencias reales de DeepSeek y Jev. Se ajustan en `src/config.ts`.
- **Ritmo según el razonamiento**: si DeepSeek razona, todas las fases van más despacio para que la
  curva sea la misma (todos al día al principio, el LLM se hunde al final): ×1 sin razonamiento,
  ×1,8 con `low`, ×2,3 con `high`, ×3 con `max` (este último estimado). La portada lo indica.
  `?ritmo=1.5` en la URL lo fuerza.
- **Dificultad constante**: hay cuatro niveles de parte de rayos X y se reparten por toda la partida
  (cada bloque de 4 bandejas seguidas tiene uno de cada, en orden aleatorio con la semilla). La
  presión la pone sólo el ritmo de las fases.
  1. Partes sencillos: 1 o 2 objetos y cifras claras.
  2. Cifras al límite (100 ml, 6 cm, 100 y 160 Wh, 350 g) y excepciones (receta, bebé, duty-free).
  3. Unidades mezcladas (cl, l, mm, kg) y 2 o 3 objetos cuyas reglas chocan.
  4. Cuentas: baterías en mAh y voltios (Wh = mAh × V / 1.000) y la suma de la bolsa de líquidos (máximo 1 litro).

## Calibración (fase 2 del plan)

1. `npm run test:cases` comprueba el generador: reparto de decisiones, que todos los partes caben en
   pantalla y que un clasificador por palabras clave **no** resuelve el reglamento (≈65-70 %).
2. Con el servidor en marcha, `npm run latency -- 40` lanza 40 partes reales a Jev y al LLM:
   latencia p50/p90, acierto y coste. Guarda las
   latencias en `logs/`.
3. `npx tsx scripts/sim-check.ts logs/latencias-XXX.json` simula las cuatro fases con esas
   latencias y dice qué porcentaje pierde cada agente por fase. El objetivo: en la fase 1 todos
   llegan; en la fase 4 Jev llega y el LLM no. Sin argumento usa las latencias de `?mock`.

## Rigor

- Misma secuencia de casos para los dos (semilla visible en pantalla y en el registro).
- Mismo reglamento (`src/sim/rules.ts`) para todos; el LLM lo recibe en el mensaje de sistema,
  igual en todas las llamadas, para que la caché de prompt de la API lo aproveche.
- LLM sin razonamiento, `max_tokens` 20, `temperature` 0, salida JSON: la forma más rápida. Con
  `LLM_THINKING=low` (el mínimo), `high` o `max` en `.env` se activa el razonamiento de DeepSeek con
  ese esfuerzo (acierta más en las cuentas y
  en las reglas que chocan, pero tarda varios segundos por bandeja); en pantalla y en el registro
  aparece como "con razonamiento bajo / alto / máximo". Para probar otro modelo,
  cambia `LLM_BASE_URL`, `LLM_MODEL` y `LLM_NAME` en `.env` (cualquier API compatible con
  `/chat/completions`; `LLM_EXTRA` añade campos al cuerpo de la petición).
- Varias ejecuciones: cada partida terminada se guarda sola en `logs/` (también con `S` se descarga). Resúmelas con
  `npm run summary -- logs/control-*.json` (media ± desviación por mostrador).
- Modo precisión: mide la precisión pura sin presión de tiempo; la pantalla final la muestra
  también cuando gana el LLM.

## Vídeo de cada partida

Cada partida se graba sola, con el sonido del juego, desde que pulsas ESPACIO hasta unos segundos
después de la pantalla de resultados. Al terminar aparece arriba a la izquierda "VÍDEO GUARDADO"
(ese aviso está fuera del lienzo y no sale en el vídeo) y el archivo queda en `videos/`, con el
mismo nombre que el registro de `logs/`.

- MP4 H.264 a 1920×1080 y 60 fps constantes, píxeles nítidos (el lienzo se escala ×4 sin suavizado
  antes de codificar), audio AAC normalizado a −16 LUFS: listo para subir a LinkedIn.
- La conversión la hace ffmpeg en el servidor (incluido en la imagen de Docker; sin Docker tiene que
  estar instalado). Tarda unos segundos después del aviso.
- Reiniciar (`R`, `N`, `M`) a mitad de partida descarta la grabación. `?norec` la desactiva.
- Con `?autostart` o `?desde` el vídeo sale mudo: el navegador no deja sonar el audio sin pulsar una tecla.

## Grabar

1. Ensaya con `?mock` y elige semilla.
2. Navegador a pantalla completa (F11) en un monitor 1080p: el lienzo de 480×270 se escala ×4,
   píxel exacto.
3. OBS → captura de ventana. Al terminar, el registro de la partida se guarda solo en `logs/`.

## Pendiente

- Modo paralelo (el LLM lanza varias llamadas a la vez) como comparativa secundaria.
- Calibrar fases y umbral con latencias reales (`npm run latency`).
