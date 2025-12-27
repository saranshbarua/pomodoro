import AppKit
import Carbon

class HotKeyManager {
    static let shared = HotKeyManager()
    
    private var hotkeys: [UInt32: () -> Void] = [:]
    private var eventHandler: EventHandlerRef?
    
    private init() {
        setupEventHandler()
    }
    
    private func setupEventHandler() {
        var eventType = EventTypeSpec(eventClass: OSType(kEventClassKeyboard), eventKind: UInt32(kEventHotKeyPressed))
        
        let handler: EventHandlerUPP = { (_, event, _) -> OSStatus in
            var hotKeyID = EventHotKeyID()
            let status = GetEventParameter(
                event,
                EventParamName(kEventParamDirectObject),
                EventParamType(typeEventHotKeyID),
                nil,
                MemoryLayout<EventHotKeyID>.size,
                nil,
                &hotKeyID
            )
            
            if status == noErr {
                HotKeyManager.shared.handleHotKey(id: hotKeyID.id)
            }
            
            return noErr
        }
        
        InstallEventHandler(GetApplicationEventTarget(), handler, 1, &eventType, nil, &eventHandler)
    }
    
    func register(id: UInt32, keyCode: UInt32, modifiers: UInt32, action: @escaping () -> Void) {
        hotkeys[id] = action
        
        let hotKeyID = EventHotKeyID(signature: OSType(0x504F4D4F), id: id) // 'POMO' in hex
        var hotKeyRef: EventHotKeyRef?
        
        RegisterEventHotKey(
            keyCode,
            modifiers,
            hotKeyID,
            GetApplicationEventTarget(),
            0,
            &hotKeyRef
        )
    }
    
    fileprivate func handleHotKey(id: UInt32) {
        if let action = hotkeys[id] {
            DispatchQueue.main.async {
                action()
            }
        }
    }
}

