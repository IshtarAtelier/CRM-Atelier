// Cierre de una tarea desde el navegador. Las de "Solicitar comentario" pasan
// por el robot que mira Google: si la reseña no figura, el server responde
// 409 y acá se pregunta. "Cancelar igual" la cierra como CANCELADA (no como
// hecha); si no, queda pendiente y sigue en seguimiento hasta conseguirla.

export async function cerrarTarea(clientId: string, taskId: string, status: string): Promise<boolean> {
    const pedir = (forzar: boolean) => fetch(`/api/contacts/${clientId}/tasks`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskId, status, forzar }),
    });

    let res = await pedir(false);
    if (res.status === 409) {
        const d = await res.json().catch(() => ({}));
        if (d.code !== 'RESENA_NO_FIGURA') return false;
        const motivo = d.error
            ? `No se pudo consultar Google (${d.error}).`
            : 'Este comentario no figura en Google.';
        const ok = window.confirm(`🤖 ${motivo}\n\n¿Cancelar igual?\n\nAceptar: se cierra como cancelada, sin reseña.\nCancelar: queda pendiente y seguís en seguimiento hasta conseguirla.`);
        if (!ok) return false;
        res = await pedir(true);
    }
    if (res.ok) window.dispatchEvent(new Event('tasks-updated'));
    return res.ok;
}
