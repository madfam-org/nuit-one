#pragma once
#include <cstdint>

extern "C" {
  // Initialize the audio engine with sample rate and buffer size
  int init_engine(uint32_t sample_rate, uint32_t buffer_size);

  // Process audio: reads from input buffer, writes to output buffer
  // Returns number of frames processed
  int process_audio(float* input, float* output, uint32_t num_frames);

  // Get pointer to internal buffer for SharedArrayBuffer mapping
  float* get_buffer_ptr();
}
