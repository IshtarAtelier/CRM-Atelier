// Dónde está la cara en cada foto, con Vision (macOS). Lo usa
// generar-feed-modelos.mjs para poner TODAS las cabezas del feed a la misma
// altura y al mismo tamaño (Ishtar, 16/10/2026: "en el feed se nota mucho").
//
//   swiftc -O -o caras caras.swift && ./caras foto1.webp foto2.webp … > caras.json
//
// Salida: { "<ruta>": { "caja": [x, y, ancho, alto], "ojos": [x, y], "yaw": g } }
// en fracciones del ancho/alto de la imagen, con el origen ARRIBA a la
// izquierda. `ojos` es el punto medio entre los dos ojos (o el ojo visible en
// un perfil); `yaw` es hacia dónde mira, en grados (negativo = a su derecha).
import Foundation
import Vision
import ImageIO

var salida: [String: Any] = [:]
for ruta in CommandLine.arguments.dropFirst() {
    guard let src = CGImageSourceCreateWithURL(URL(fileURLWithPath: ruta) as CFURL, nil),
          let img = CGImageSourceCreateImageAtIndex(src, 0, nil) else { salida[ruta] = NSNull(); continue }
    // La orientación EXIF (los originales de la sesión vienen girados): Vision
    // trabaja sobre la imagen ya derecha y las fracciones salen respecto de ella.
    let props = CGImageSourceCopyPropertiesAtIndex(src, 0, nil) as? [CFString: Any]
    let orientacion = CGImagePropertyOrientation(rawValue: (props?[kCGImagePropertyOrientation] as? UInt32) ?? 1) ?? .up
    let req = VNDetectFaceLandmarksRequest()
    try? VNImageRequestHandler(cgImage: img, orientation: orientacion, options: [:]).perform([req])
    guard let cara = (req.results ?? []).max(by: { $0.boundingBox.width < $1.boundingBox.width }) else { salida[ruta] = NSNull(); continue }
    let b = cara.boundingBox   // origen abajo a la izquierda
    var ojos: [Double] = [b.midX, 1 - (b.minY + b.height * 0.65)]
    if let lm = cara.landmarks {
        var puntos: [CGPoint] = []
        for ojo in [lm.leftEye, lm.rightEye] {
            guard let o = ojo, o.pointCount > 0 else { continue }
            let p = o.normalizedPoints
            let c = p.reduce(CGPoint.zero) { CGPoint(x: $0.x + $1.x / CGFloat(p.count), y: $0.y + $1.y / CGFloat(p.count)) }
            puntos.append(CGPoint(x: b.minX + c.x * b.width, y: b.minY + c.y * b.height))
        }
        if !puntos.isEmpty {
            let m = puntos.reduce(CGPoint.zero) { CGPoint(x: $0.x + $1.x / CGFloat(puntos.count), y: $0.y + $1.y / CGFloat(puntos.count)) }
            ojos = [Double(m.x), Double(1 - m.y)]
        }
    }
    salida[ruta] = [
        "caja": [Double(b.minX), Double(1 - b.maxY), Double(b.width), Double(b.height)],
        "ojos": ojos,
        "yaw": Double(truncating: cara.yaw ?? 0) * 180 / Double.pi,
    ]
}
let json = try! JSONSerialization.data(withJSONObject: salida, options: [.sortedKeys])
FileHandle.standardOutput.write(json)
