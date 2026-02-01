# Flujo: Arreglos → Actualización

## Enlace automático

**Cada arreglo en la app debe quedar enlazado mediante script para ir actualizando.**

### Script único (enlace)

```batch
DEPLOY_ARREGLOS.bat
```

O: `python scripts/ejecutar_pasos_completos.py`

### Qué hace

1. **Bump versión** – Si hay cambios, incrementa patch (1.0.8 → 1.0.9)
2. **Build** – Limpia caché, compila frontend
3. **Git** – add, commit, push a `maestro`
4. **Deploy** – Vercel + Railway
5. **Verificación** – Comprueba versión en Vercel

### Regla

**Tras cada arreglo o mejora en la app → ejecutar `DEPLOY_ARREGLOS.bat`**

Así los cambios quedan enlazados y los usuarios reciben la actualización.

### Otras entradas al mismo flujo

- `ACTUALIZAR_AUTO.bat` – Mismo flujo
- `EJECUTAR_TODO.bat` – Mismo flujo
- `configurar_todo_automatico.bat` – Configura + ejecuta el flujo una vez
