cmake_minimum_required(VERSION 3.20)
project(nuit_audio_engine)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# Source files
set(SOURCES
  src/ring_buffer.cpp
  src/audio_processor.cpp
)

# Emscripten compile to WASM
add_executable(audio_engine ${SOURCES})

target_include_directories(audio_engine PRIVATE src)

# Emscripten settings for AudioWorklet compatibility
set_target_properties(audio_engine PROPERTIES
  SUFFIX ".js"
  LINK_FLAGS "-s WASM=1 \
              -s EXPORTED_FUNCTIONS=['_process_audio','_init_engine','_get_buffer_ptr','_malloc','_free'] \
              -s EXPORTED_RUNTIME_METHODS=['ccall','cwrap'] \
              -s ALLOW_MEMORY_GROWTH=1 \
              -s INITIAL_MEMORY=16777216 \
              -s ENVIRONMENT='web,worker' \
              -s MODULARIZE=1 \
              -s EXPORT_NAME='NuitAudioEngine' \
              -O2"
)
