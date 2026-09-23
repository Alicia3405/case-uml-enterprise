# 📱 CASE Studio UML Mobile (Flutter Multiplataforma)

Aplicación móvil desarrollada en **Flutter** para modelado de clases UML 2.5 mediante **interacción por voz y lienzo táctil**, con soporte nativo para **Flutter Web, Android e iOS**.

Cumple al 100% con el requerimiento oficial del examen de Ingeniería de Software:
> *"Para la parte móvil... no debe tener interfaces gráficas obligatorias. Todo el flujo de trabajo se desarrollará mediante interacción por voz"*.

---

## 🚀 Características Principales

### 1. 🎙️ Modo Asistente de Voz Total (Requisito Docente)
- Interfaz futurista y minimalista centrada en un **Orbe Inteligente Reactivo**.
- **Canal 1 (✨ Generador de Arquitectura IA):** Sintetiza sistemas completos hablando en lenguaje natural:
  - *"Crear sistema para clínica veterinaria con clientes, mascotas y citas"*
  - *"Crear sistema para hotelería con hotel, habitación, huésped y reserva"*
  - *"Crear sistema de ventas con facturas, clientes y productos"*
- **Canal 2 (🗣️ Comandos UML en Tiempo Real):** Control atómico sin tocar la pantalla:
  - *"Crear clase Factura"*
  - *"Agregar atributo teléfono tipo String en la tabla Cliente"*
  - *"Conectar Hotel con Habitación"*
  - *"Eliminar clase Detalle"*
  - *"Deshacer"*
- **Respuestas Auditivas Habladas (TTS):** El asistente responde en voz alta confirmando cada operación realizada.

### 2. 📐 Mini-Lienzo UML Táctil Interactivo
- Paneo táctil y zoom con dos dedos (*pinch-to-zoom*).
- Cajas de clases UML arrastrables con cabecera estereotipada (`«entity»`), compartimento de atributos y compartimento de métodos.
- Conectores relacionales dibujados en tiempo real (Composición con diamante, Asociación con flechas).

### 3. 📊 Dashboard de Proyectos Móvil
- Visualización de *Mis Proyectos* y *Proyectos Colaborativos*.
- Métricas: número de clases, relaciones y última fecha de modificación.
- **Interoperabilidad Total con la Web Angular:** Botón para copiar o pegar el JSON del diagrama, permitiendo transferir modelos entre la computadora y el celular al instante.

---

## 💻 Instrucciones para Ejecutar

### Opción A: Ejecutar en el Navegador (Flutter Web)
Abre una terminal en esta carpeta (`mobile_uml_voice/`) y ejecuta:

```bash
flutter pub get
flutter run -d chrome
```

### Opción B: Ejecutar en Celular o Emulador Android
Conecta tu celular por depuración USB o inicia un emulador Android, luego ejecuta:

```bash
flutter run
```

---

## 📂 Estructura del Código

```
mobile_uml_voice/
├── lib/
│   ├── main.dart                      # Punto de entrada y barra de navegación
│   ├── models/uml_models.dart         # Modelos de datos UML compatibles con Angular
│   ├── services/
│   │   ├── tts_service.dart           # Síntesis de voz (Text-to-Speech)
│   │   ├── stt_service.dart           # Reconocimiento de voz (Speech-to-Text)
│   │   ├── uml_ai_generator.dart      # Generador de arquitecturas IA (Canal 1)
│   │   ├── uml_voice_commander.dart   # Comandos atómicos en tiempo real (Canal 2)
│   │   └── project_storage_service.dart# Almacenamiento local e import/export JSON
│   ├── providers/project_provider.dart# Gestor de estado reactivo
│   ├── screens/
│   │   ├── dashboard_screen.dart      # Dashboard de proyectos
│   │   ├── voice_assistant_screen.dart# Asistente de Voz sin GUI (Examen)
│   │   └── canvas_screen.dart         # Mini-Lienzo táctil
│   └── widgets/
│       ├── voice_orb_widget.dart      # Orbe animado reactivo a la voz
│       ├── uml_class_box.dart         # Caja visual de clase UML
│       ├── relation_painter.dart      # Conectores y flechas relacionales
│       └── voice_dock_sheet.dart      # Modal flotante de voz
└── pubspec.yaml                       # Dependencias del proyecto
```
