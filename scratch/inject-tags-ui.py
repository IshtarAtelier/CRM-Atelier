import sys

file_path = "/Users/ishtarpissano/proyectos/atelier/src/app/admin/configuracion/page.tsx"
with open(file_path, "r") as f:
    content = f.read()

# 1. Add state types and variables
state_injection = """
    // Tags state
    interface TagConfig {
        id: string; name: string; color: string; botAction: string; notifyPhone: string | null;
    }
    const [tags, setTags] = useState<TagConfig[]>([]);
    const [newTagName, setNewTagName] = useState('');
    const [newTagColor, setNewTagColor] = useState('#9e7f65');
    const [newTagBotAction, setNewTagBotAction] = useState('NONE');
    const [newTagNotifyPhone, setNewTagNotifyPhone] = useState('');
    const [addingTag, setAddingTag] = useState(false);
    const [editingTagId, setEditingTagId] = useState<string | null>(null);
    const [editTagData, setEditTagData] = useState<Partial<TagConfig>>({});

"""
content = content.replace("    // Labs state", state_injection + "    // Labs state")

# 2. Add fetchTags to useEffect
content = content.replace("fetchServices();", "fetchServices();\n        fetchTags();")

# 3. Add Tag functions
functions_injection = """
    const fetchTags = async () => {
        try {
            const res = await fetch('/api/tags');
            if (res.ok) {
                const data = await res.json();
                setTags(data || []);
            }
        } catch (error) {
            console.error('Error fetching tags:', error);
        }
    };
    
    const handleAddTag = async () => {
        if (!newTagName.trim()) return;
        setAddingTag(true);
        try {
            const res = await fetch('/api/tags', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: newTagName.trim(), color: newTagColor, botAction: newTagBotAction, notifyPhone: newTagNotifyPhone || null })
            });
            if (res.ok) {
                setMessage({ type: 'success', text: `Etiqueta agregada` });
                setNewTagName(''); setNewTagBotAction('NONE'); setNewTagNotifyPhone('');
                await fetchTags();
            } else {
                setMessage({ type: 'error', text: 'Error al agregar etiqueta' });
            }
        } catch {
            setMessage({ type: 'error', text: 'Error de conexión' });
        }
        setAddingTag(false);
    };

    const handleSaveTag = async (id: string) => {
        try {
            const res = await fetch(`/api/tags/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(editTagData)
            });
            if (res.ok) {
                setMessage({ type: 'success', text: 'Etiqueta actualizada' });
                setEditingTagId(null);
                await fetchTags();
            } else {
                setMessage({ type: 'error', text: 'Error al actualizar' });
            }
        } catch {
            setMessage({ type: 'error', text: 'Error de conexión' });
        }
    };

    const handleDeleteTag = async (id: string) => {
        if (!confirm('¿Eliminar etiqueta?')) return;
        try {
            const res = await fetch(`/api/tags/${id}`, { method: 'DELETE' });
            if (res.ok) {
                setMessage({ type: 'success', text: 'Etiqueta eliminada' });
                await fetchTags();
            }
        } catch {
            setMessage({ type: 'error', text: 'Error' });
        }
    };
"""
content = content.replace("    const fetchServices = async () => {", functions_injection + "\n    const fetchServices = async () => {")

# 4. Add JSX Section
jsx_injection = """
            {/* Tags Section */}
            <section className="mt-8 bg-white dark:bg-stone-800 border-2 border-stone-100 dark:border-stone-700 rounded-2xl overflow-hidden">
                <div className="p-6 flex items-center justify-between border-b-2 border-stone-100 dark:border-stone-700">
                    <div className="flex items-center gap-2">
                        <Database className="w-5 h-5 text-primary" />
                        <h2 className="text-xs font-black uppercase tracking-widest text-stone-400">Etiquetas y Automatizaciones</h2>
                        <span className="ml-2 px-2.5 py-0.5 bg-stone-100 dark:bg-stone-700 rounded-full text-[10px] font-black text-stone-500">
                            {tags.length}
                        </span>
                    </div>
                </div>
                <div className="p-6 bg-stone-50 dark:bg-stone-900 border-b-2 border-stone-100 dark:border-stone-700">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                        <input type="text" placeholder="Nombre" value={newTagName} onChange={e => setNewTagName(e.target.value)} className="px-3 py-2 border-2 border-stone-200 dark:border-stone-600 rounded-lg text-sm bg-white dark:bg-stone-800 outline-none focus:border-primary" />
                        <input type="color" value={newTagColor} onChange={e => setNewTagColor(e.target.value)} className="h-10 w-full border-2 border-stone-200 dark:border-stone-600 rounded-lg cursor-pointer" />
                        <select value={newTagBotAction} onChange={e => setNewTagBotAction(e.target.value)} className="px-3 py-2 border-2 border-stone-200 dark:border-stone-600 rounded-lg text-sm bg-white dark:bg-stone-800 outline-none focus:border-primary">
                            <option value="NONE">Sin Acción de Bot</option>
                            <option value="TURN_OFF">Apagar Bot</option>
                            <option value="TURN_ON">Encender Bot</option>
                        </select>
                        <input type="text" placeholder="WhatsApp Notificación (ej: 549351...)" value={newTagNotifyPhone} onChange={e => setNewTagNotifyPhone(e.target.value)} className="px-3 py-2 border-2 border-stone-200 dark:border-stone-600 rounded-lg text-sm bg-white dark:bg-stone-800 outline-none focus:border-primary" />
                    </div>
                    <button onClick={handleAddTag} disabled={addingTag} className="mt-3 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-xs font-bold shadow-lg shadow-primary/20">Agregar Etiqueta</button>
                </div>
                <div className="divide-y-2 divide-stone-50 dark:divide-stone-700/50">
                    {tags.map(tag => (
                        <div key={tag.id} className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-stone-50/50 dark:hover:bg-stone-900/50 transition-all">
                            {editingTagId === tag.id ? (
                                <>
                                    <div className="flex gap-2 flex-wrap flex-1 items-center">
                                        <input type="text" value={editTagData.name || ''} onChange={e => setEditTagData({...editTagData, name: e.target.value})} className="px-2 py-1.5 border-2 border-primary rounded-lg text-sm bg-white dark:bg-stone-900 w-32 outline-none" />
                                        <input type="color" value={editTagData.color || '#000'} onChange={e => setEditTagData({...editTagData, color: e.target.value})} className="h-8 rounded cursor-pointer" />
                                        <select value={editTagData.botAction || 'NONE'} onChange={e => setEditTagData({...editTagData, botAction: e.target.value})} className="px-2 py-1.5 border-2 border-primary rounded-lg text-sm bg-white dark:bg-stone-900 outline-none">
                                            <option value="NONE">Ninguna</option>
                                            <option value="TURN_OFF">Apagar Bot</option>
                                            <option value="TURN_ON">Encender Bot</option>
                                        </select>
                                        <input type="text" value={editTagData.notifyPhone || ''} onChange={e => setEditTagData({...editTagData, notifyPhone: e.target.value})} placeholder="WhatsApp" className="px-2 py-1.5 border-2 border-primary rounded-lg text-sm bg-white dark:bg-stone-900 w-40 outline-none" />
                                    </div>
                                    <div className="flex gap-2">
                                        <button onClick={() => handleSaveTag(tag.id)} className="p-2 bg-emerald-500 text-white rounded-lg hover:scale-105"><Save className="w-4 h-4"/></button>
                                        <button onClick={() => setEditingTagId(null)} className="p-2 bg-stone-200 dark:bg-stone-600 text-stone-500 dark:text-stone-300 rounded-lg hover:scale-105"><X className="w-4 h-4"/></button>
                                    </div>
                                </>
                            ) : (
                                <>
                                    <div className="flex items-center gap-3">
                                        <div className="w-4 h-4 rounded-full shadow-sm" style={{backgroundColor: tag.color || '#ccc'}}></div>
                                        <span className="font-bold text-sm text-stone-700 dark:text-stone-200">{tag.name}</span>
                                        {tag.botAction !== 'NONE' && <span className="text-[10px] bg-stone-200 dark:bg-stone-700 px-2 py-0.5 rounded-md font-bold uppercase">{tag.botAction === 'TURN_OFF' ? 'Apagar Bot' : 'Encender Bot'}</span>}
                                        {tag.notifyPhone && <span className="text-[10px] bg-stone-200 dark:bg-stone-700 px-2 py-0.5 rounded-md font-bold">📞 {tag.notifyPhone}</span>}
                                    </div>
                                    <div className="flex gap-2">
                                        <button onClick={() => { setEditingTagId(tag.id); setEditTagData(tag); }} className="p-2.5 bg-stone-50 dark:bg-stone-700 text-stone-400 rounded-xl hover:bg-blue-50 hover:text-blue-500"><Pencil className="w-4 h-4"/></button>
                                        <button onClick={() => handleDeleteTag(tag.id)} className="p-2.5 bg-stone-50 dark:bg-stone-700 text-stone-400 rounded-xl hover:bg-red-50 hover:text-red-500"><Trash2 className="w-4 h-4"/></button>
                                    </div>
                                </>
                            )}
                        </div>
                    ))}
                </div>
            </section>
"""
content = content.replace("{/* WhatsApp Agent Section */}", jsx_injection + "\n            {/* WhatsApp Agent Section */}")

with open(file_path, "w") as f:
    f.write(content)
print("Injected tags UI")
