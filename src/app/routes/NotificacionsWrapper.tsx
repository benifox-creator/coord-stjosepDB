import { useEffect } from 'react'
import { NotificacionsPage } from '../../modules/notificacions/NotificacionsPage'
import { useNotificacions } from '../../modules/notificacions/useNotificacions'

export default function NotificacionsWrapper() {
  const { notificacions, loading, error, load, reintentar, cancellar } = useNotificacions()
  useEffect(() => { void load() }, [load])
  return (
    <NotificacionsPage
      notificacions={notificacions}
      loading={loading}
      error={error}
      onRefresh={() => void load()}
      onReintentar={reintentar}
      onCancellar={cancellar}
    />
  )
}
