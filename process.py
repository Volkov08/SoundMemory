import os
import soundfile as sf

import matplotlib.pyplot as plt
import numpy as np

inputDir = "rawFiles"
outputDir = "sounds" 

rawFiles = os.listdir(rawFiles)

for file in rawFiles:
    audio, samplerate = sf.read(inputDir + "/" + file)
    cut(audio, samplerate)

def cut(audio, samplerate):
    time = np.arange(0, len(audio)/samplerate, 1/samplerate)
    plt.plot(time, audio)
    plt.show()
    