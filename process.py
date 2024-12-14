import os
import pydub as pd

#this directory is empty in the repo since i does not make sense to store the entire (sometimes large) audio files in the repo
inputDir = "rawFiles"
outputDir = "sounds" 

rawFiles = os.listdir(inputDir)
segmentDuration = 5000
sweepDuration = 1000

def clearDir(dir):
    for file in os.listdir(dir):
        os.remove(dir + "/" + file)


#cut audio files into segments without silence
def cut(audio):
    if audio.duration_seconds < segmentDuration/1000:
        return None
    loudest = audio[:-segmentDuration].max_dBFS
    validSegment = None
    for i in range(int((len(audio)-segmentDuration)/sweepDuration)):
        segment = audio[i*sweepDuration:(i+1)*sweepDuration]
        if segment.max_dBFS >= loudest-3:
            validSegment = audio[i*sweepDuration:i*sweepDuration + segmentDuration]
            break
    if validSegment is None:
        return None
    normalized = pd.effects.normalize(validSegment)
    faded = normalized.fade_in(500).fade_out(500)
    return faded

def genFilename(file,i):
    return outputDir + "/" + str(i) +"_" + file.replace(" ","").replace("-","_")

clearDir(outputDir)

i = 0
for file in rawFiles:
    audio = pd.AudioSegment.from_mp3(inputDir + "/" + file)
    if not "00" in file:
        pass
        #continue
    cutAudio = cut(audio)
    if cutAudio is None:
        print("No valid segment found in " + file)
        continue
    cutAudio.export(genFilename(file,i), format="mp3")
    i += 1

#generate index file
index = open(outputDir+"/index.json", "w")
index.write("[")

#comma before each filename except the first for valid json (smh no trailing commas)
comma = False
for file in os.listdir(outputDir):
    if not file.endswith(".mp3"):
        continue
    if not comma:
        comma = True
    else:
        index.write(",")
    index.write('\n"' + file + '"')

index.write("\n]")
index.close()
