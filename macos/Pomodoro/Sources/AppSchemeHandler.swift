import WebKit
import UniformTypeIdentifiers
import Foundation

class AppSchemeHandler: NSObject, WKURLSchemeHandler {
    func webView(_ webView: WKWebView, start urlSchemeTask: WKURLSchemeTask) {
        guard let url = urlSchemeTask.request.url else { return }
        
        // Remove 'app://localhost/' to get the relative path
        var path = url.path
        if path.hasPrefix("/") {
            path.removeFirst()
        }
        
        // Default to index.html if path is empty
        if path.isEmpty {
            path = "index.html"
        }
        
        // Look for the file in the 'dist' folder in resources
        if let resourcePath = Bundle.main.resourcePath {
            let fullPath = (resourcePath as NSString).appendingPathComponent("dist/\(path)")
            let fileUrl = URL(fileURLWithPath: fullPath)
            
            if let data = try? Data(contentsOf: fileUrl) {
                let mimeType = mimeType(for: path)
                let response = HTTPURLResponse(
                    url: url,
                    statusCode: 200,
                    httpVersion: "HTTP/1.1",
                    headerFields: [
                        "Content-Type": mimeType,
                        "Access-Control-Allow-Origin": "*" // Explicitly allow CORS
                    ]
                )!
                
                urlSchemeTask.didReceive(response)
                urlSchemeTask.didReceive(data)
                urlSchemeTask.didFinish()
                return
            }
        }
        
        // If file not found
        let error = NSError(domain: NSURLErrorDomain, code: NSURLErrorFileDoesNotExist, userInfo: nil)
        urlSchemeTask.didFailWithError(error)
    }
    
    func webView(_ webView: WKWebView, stop urlSchemeTask: WKURLSchemeTask) {
        // No-op
    }
    
    private func mimeType(for path: String) -> String {
        let extension_ = (path as NSString).pathExtension.lowercased()
        if let type = UTType(filenameExtension: extension_) {
            return type.preferredMIMEType ?? "application/octet-stream"
        }
        return "application/octet-stream"
    }
}

