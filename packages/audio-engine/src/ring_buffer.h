#pragma once
#include <atomic>
#include <cstddef>
#include <cstring>

// Single-Producer Single-Consumer lock-free ring buffer
// Designed for AudioWorklet <-> main thread communication via SharedArrayBuffer
class RingBuffer {
public:
  RingBuffer(float* buffer, size_t capacity);

  // Producer: write samples into the buffer
  size_t write(const float* data, size_t count);

  // Consumer: read samples from the buffer
  size_t read(float* data, size_t count);

  // Query available space
  size_t availableRead() const;
  size_t availableWrite() const;

  void reset();

private:
  float* buffer_;
  size_t capacity_;
  std::atomic<size_t> readPos_{0};
  std::atomic<size_t> writePos_{0};
};
