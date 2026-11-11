-- queue_email deixava que qualsevol usuari amb rol de creador encués un correu
-- amb l'assumpte i el text que volgués, enviat des de no-reply@stjosep.org a
-- qualsevol usuari registrat: una via de pesca (phishing) des d'una adreça
-- oficial. L'aplicació no la feia servir. Els correus automàtics surten dels
-- disparadors i de les funcions de cada mòdul, amb textos fixos.
begin;
revoke execute on function public.queue_email(text,text,text) from authenticated;
commit;
