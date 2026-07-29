# Pinned BlazePose model artifacts

These TensorFlow.js graph-model artifacts are used for private, server-local
tattoo projection geometry. Cast pixels are decoded and evaluated inside the
Drape process; they are not uploaded to TensorFlow Hub.

Sources:

- Detector v1:
  `https://tfhub.dev/mediapipe/tfjs-model/blazepose_3d/detector/1`
- Full landmark model v2:
  `https://tfhub.dev/mediapipe/tfjs-model/blazepose_3d/landmark/full/2`

The upstream implementation and models are distributed by Google under the
Apache License 2.0. Exact byte lengths and SHA-256 digests are pinned in
`poseModelArtifacts.ts`; a mismatch fails closed before inference.
