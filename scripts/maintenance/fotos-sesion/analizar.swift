import Foundation
import Vision
import AppKit
import CoreImage
// uso: analizar <dirMascaras> foto1 foto2 ...  → JSON con cara, manos, tope de la cabeza; y la máscara de la persona en PNG
let dirMask = CommandLine.arguments[1]
var salida: [String: Any] = [:]
let ctx = CIContext()
for ruta in CommandLine.arguments.dropFirst(2) {
    guard let img = NSImage(contentsOfFile: ruta), let cg = img.cgImage(forProposedRect: nil, context: nil, hints: nil) else { continue }
    let W = CGFloat(cg.width), H = CGFloat(cg.height)
    var item: [String: Any] = ["W": Int(W), "H": Int(H)]
    let caras = VNDetectFaceRectanglesRequest()
    let marcas = VNDetectFaceLandmarksRequest()
    let manos = VNDetectHumanHandPoseRequest(); manos.maximumHandCount = 2
    let seg = VNGeneratePersonSegmentationRequest(); seg.qualityLevel = .accurate; seg.outputPixelFormat = kCVPixelFormatType_OneComponent8
    try? VNImageRequestHandler(cgImage: cg, options: [:]).perform([caras, marcas, manos, seg])
    if let c = caras.results?.max(by: { $0.boundingBox.width * $0.boundingBox.height < $1.boundingBox.width * $1.boundingBox.height }) {
        let bb = c.boundingBox
        item["cara"] = ["x": Int(bb.minX * W), "y": Int((1 - bb.maxY) * H), "w": Int(bb.width * W), "h": Int(bb.height * H), "yaw": c.yaw?.doubleValue ?? 0]
    }
    // rasgos de la cara (ojos, cejas, labios, nariz) como cajas en píxeles: zonas que NO se aclaran
    if let f = marcas.results?.max(by: { $0.boundingBox.width < $1.boundingBox.width }), let lm = f.landmarks {
        let bb = f.boundingBox
        var rasgos: [String: [Int]] = [:]
        let regiones: [(String, VNFaceLandmarkRegion2D?)] = [("ojoIzq", lm.leftEye), ("ojoDer", lm.rightEye), ("cejaIzq", lm.leftEyebrow), ("cejaDer", lm.rightEyebrow), ("labios", lm.outerLips), ("nariz", lm.nose)]
        for (nombre, reg) in regiones {
            guard let r = reg, r.pointCount > 0 else { continue }
            let pts = r.normalizedPoints.map { CGPoint(x: (bb.minX + $0.x * bb.width) * W, y: (1 - (bb.minY + $0.y * bb.height)) * H) }
            let xs = pts.map { $0.x }, ys = pts.map { $0.y }
            rasgos[nombre] = [Int(xs.min()!), Int(ys.min()!), Int(xs.max()!), Int(ys.max()!)]
        }
        item["rasgos"] = rasgos
    }
    var listaManos: [[String: Any]] = []
    for m in manos.results ?? [] {
        guard let pts = try? m.recognizedPoints(.all) else { continue }
        let ok = pts.values.filter { $0.confidence > 0.3 }
        if ok.count < 5 { continue }
        let xs = ok.map { $0.location.x * W }, ys = ok.map { (1 - $0.location.y) * H }
        var mano: [String: Any] = ["x": Int(xs.min()!), "y": Int(ys.min()!), "w": Int(xs.max()! - xs.min()!), "h": Int(ys.max()! - ys.min()!)]
        for (nombre, j) in [("pulgar", VNHumanHandPoseObservation.JointName.thumbTip), ("indice", .indexTip)] {
            if let p = try? m.recognizedPoint(j), p.confidence > 0.3 { mano[nombre] = [Int(p.location.x * W), Int((1 - p.location.y) * H)] }
        }
        listaManos.append(mano)
    }
    item["manos"] = listaManos
    if let obs = seg.results?.first {
        let pb = obs.pixelBuffer
        CVPixelBufferLockBaseAddress(pb, .readOnly)
        let mw = CVPixelBufferGetWidth(pb), mh = CVPixelBufferGetHeight(pb), stride = CVPixelBufferGetBytesPerRow(pb)
        let base = CVPixelBufferGetBaseAddress(pb)!.assumingMemoryBound(to: UInt8.self)
        var cabeza = -1
        for y in 0..<mh { var n = 0; for x in 0..<mw where base[y * stride + x] > 128 { n += 1 }; if n > mw / 50 { cabeza = y; break } }
        CVPixelBufferUnlockBaseAddress(pb, .readOnly)
        item["cabezaY"] = cabeza < 0 ? -1 : Int(CGFloat(cabeza) * H / CGFloat(mh))
        let ci = CIImage(cvPixelBuffer: pb)
        let nombre = ((ruta as NSString).lastPathComponent as NSString).deletingPathExtension + ".png"
        if let cgm = ctx.createCGImage(ci, from: ci.extent) {
            let rep = NSBitmapImageRep(cgImage: cgm)
            try? rep.representation(using: .png, properties: [:])?.write(to: URL(fileURLWithPath: dirMask + "/" + nombre))
        }
    }
    salida[(ruta as NSString).lastPathComponent] = item
}
FileHandle.standardOutput.write(try! JSONSerialization.data(withJSONObject: salida))
