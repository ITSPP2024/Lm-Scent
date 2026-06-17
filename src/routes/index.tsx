import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";

import ScreenFrame from "@/components/ScreenFrame";

import { initDatabase } from "@/lib/initDatabase";

function Home() {

useEffect(()=>{

initDatabase();

},[]);

return (
<ScreenFrame
src="/screens/welcome.html"
title="Bienvenida"
/>
);

}

export const Route =
createFileRoute("/")({

head:()=>({

meta:[
{
title:
"SCENT LM | Bienvenida"
}
]

}),

component:
Home

});