cmake_minimum_required(VERSION 3.25)

project(pear_fs C)

include(pear)

add_pear_module(pear_fs)

target_sources(
  pear_fs
  PRIVATE
    binding.c
)
