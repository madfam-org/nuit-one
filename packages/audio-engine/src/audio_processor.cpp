#include "audio_processor.h"
#include <cstdlib>
#include <cstring>

// Internal state for the audio engine
static float* g_buffer = nullptr;
static uint32_t g_buffer_size = 0;
static uint32_t g_sample_rate = 0;
static bool g_initialized = false;

extern "C" {

int init_engine(uint32_t sample_rate, uint32_t buffer_size) {
  // Free any previously allocated buffer
  if (g_buffer != nullptr) {
    std::free(g_buffer);
    g_buffer = nullptr;
  }

  g_sample_rate = sample_rate;
  g_buffer_size = buffer_size;

  // Allocate internal buffer (stereo: 2 channels)
  g_buffer = static_cast<float*>(std::calloc(buffer_size * 2, sizeof(float)));
  if (g_buffer == nullptr) {
    g_initialized = false;
    return -1;
  }

  g_initialized = true;
  return 0;
}

int process_audio(float* input, float* output, uint32_t num_frames) {
  if (!g_initialized || input == nullptr || output == nullptr) {
    return -1;
  }

  // Phase 0: Simple passthrough -- copy input directly to output.
  // This proves the WASM pipeline works end-to-end.
  // Future phases will insert DSP processing here.
  std::memcpy(output, input, num_frames * sizeof(float));

  return static_cast<int>(num_frames);
}

float* get_buffer_ptr() {
  return g_buffer;
}

} // extern "C"
