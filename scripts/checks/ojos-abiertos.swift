// ¿Tiene los ojos abiertos? Apertura de cada ojo con los landmarks de Vision
// (macOS): alto del contorno del ojo dividido por su ancho. Un ojo abierto
// mirando a cámara da ~0,30 o más; cerrado o mirando al piso, menos de ~0,18.
// Lo usa scripts/checks/ojos-abiertos.mjs para revisar las fotos de frente de
// las sesiones antes de que salgan en una placa (Ishtar, 20/10/2026: Hermes C1
// salió con los ojos cerrados).
//
//   swiftc -O -o ojos-abiertos ojos-abiertos.swift && ./ojos-abiertos foto1.jpg … > ojos.json
//
// Salida: { "<ruta>": { "izq": 0.31, "der": 0.29, "yaw": g } } (null si no hay cara).
import Foundation
import Vision
import ImageIO

func apertura(_ region: VNFaceLandmarkRegion2D?) -> Double? {
    guard let r = region, r.pointCount >= 4 else { return nil }
    let p = r.normalizedPoints
    let xs = p.map { Double($0.x) }, ys = p.map { Double($0.y) }
    let ancho = (xs.max() ?? 0) - (xs.min() ?? 0)
    let alto = (ys.max() ?? 0) - (ys.min() ?? 0)
    return ancho > 0 ? alto / ancho : nil
}

var salida: [String: Any] = [:]
for ruta in CommandLine.arguments.dropFirst() {
    guard let src = CGImageSourceCreateWithURL(URL(fileURLWithPath: ruta) as CFURL, nil),
          let img = CGImageSourceCreateImageAtIndex(src, 0, nil) else { salida[ruta] = NSNull(); continue }
    let props = CGImageSourceCopyPropertiesAtIndex(src, 0, nil) as? [CFString: Any]
    let orientacion = CGImagePropertyOrientation(rawValue: (props?[kCGImagePropertyOrientation] as? UInt32) ?? 1) ?? .up
    let req = VNDetectFaceLandmarksRequest()
    try? VNImageRequestHandler(cgImage: img, orientation: orientacion, options: [:]).perform([req])
    guard let cara = (req.results ?? []).max(by: { $0.boundingBox.width < $1.boundingBox.width }), let lm = cara.landmarks else { salida[ruta] = NSNull(); continue }
    var fila: [String: Any] = ["yaw": Double(truncating: cara.yaw ?? 0) * 180 / Double.pi]
    fila["izq"] = apertura(lm.leftEye).map { $0 as Any } ?? NSNull()
    fila["der"] = apertura(lm.rightEye).map { $0 as Any } ?? NSNull()
    salida[ruta] = fila
}
let json = try! JSONSerialization.data(withJSONObject: salida, options: [.sortedKeys])
FileHandle.standardOutput.write(json)
