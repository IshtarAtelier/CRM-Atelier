# ⚠️ Estas imágenes NO son basura — el sitio las necesita

Parecen tres fotos sueltas en una carpeta, pero hay código que las abre **por
ruta fija**. Si se borran o se renombran, el catálogo PDF sale roto.

| Archivo | Para qué |
|---|---|
| `monalisa.webp` | La **tapa** del catálogo PDF |
| `filmmaker-frida.webp` | La **portada de la sección Acetato** |
| `filmmaker-dali.webp` | La **contratapa** |

Las lee `src/app/api/catalog/route.ts`, que es la ruta que arma el catálogo
cuando alguien lo descarga desde el panel (Sitio Web → catálogo).

## Por qué esto es peligroso si se borra

Borrarlas **no rompe el build ni el typecheck**: el proyecto compila igual y
todo parece estar bien. El error aparece recién en producción, cuando alguien
pide el catálogo — o sea, lejos del borrado que lo causó y sin que nadie
relacione una cosa con la otra.

## La red de seguridad

`npm run check:orden` verifica que estos archivos existan y **falla** si falta
alguno. No hace falta acordarse de esta ficha: el check avisa solo, y también
corre en CI antes de cada deploy.

Si aparece el error, se recuperan del historial de git:

```bash
git checkout HEAD~1 -- public/images/editorial/
```

> **Al agregar un archivo nuevo que el código lea por ruta fija**, sumalo a la
> lista `NECESARIOS` en `scripts/checks/orden-del-repo.check.mjs`. Si no está
> ahí, nada lo protege.
