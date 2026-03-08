#include "ring_buffer.h"

RingBuffer::RingBuffer(float* buffer, size_t capacity)
    : buffer_(buffer), capacity_(capacity) {}

size_t RingBuffer::availableRead() const {
  const size_t w = writePos_.load(std::memory_order_acquire);
  const size_t r = readPos_.load(std::memory_order_relaxed);
  if (w >= r) {
    return w - r;
  }
  return capacity_ - r + w;
}

size_t RingBuffer::availableWrite() const {
  // One slot is always kept empty to distinguish full from empty
  return capacity_ - 1 - availableRead();
}

size_t RingBuffer::write(const float* data, size_t count) {
  const size_t avail = availableWrite();
  if (count > avail) {
    count = avail;
  }
  if (count == 0) {
    return 0;
  }

  const size_t wp = writePos_.load(std::memory_order_relaxed);

  // Calculate how many samples fit before wrapping
  const size_t firstPart = capacity_ - wp;
  if (count <= firstPart) {
    // No wrap needed
    std::memcpy(buffer_ + wp, data, count * sizeof(float));
  } else {
    // Write wraps around: two memcpy calls
    std::memcpy(buffer_ + wp, data, firstPart * sizeof(float));
    std::memcpy(buffer_, data + firstPart, (count - firstPart) * sizeof(float));
  }

  // Release-store so the consumer sees the written data
  writePos_.store((wp + count) % capacity_, std::memory_order_release);
  return count;
}

size_t RingBuffer::read(float* data, size_t count) {
  const size_t avail = availableRead();
  if (count > avail) {
    count = avail;
  }
  if (count == 0) {
    return 0;
  }

  const size_t rp = readPos_.load(std::memory_order_relaxed);

  // Calculate how many samples fit before wrapping
  const size_t firstPart = capacity_ - rp;
  if (count <= firstPart) {
    // No wrap needed
    std::memcpy(data, buffer_ + rp, count * sizeof(float));
  } else {
    // Read wraps around: two memcpy calls
    std::memcpy(data, buffer_ + rp, firstPart * sizeof(float));
    std::memcpy(data + firstPart, buffer_, (count - firstPart) * sizeof(float));
  }

  // Release-store so the producer sees the updated read position
  readPos_.store((rp + count) % capacity_, std::memory_order_release);
  return count;
}

void RingBuffer::reset() {
  readPos_.store(0, std::memory_order_release);
  writePos_.store(0, std::memory_order_release);
}
