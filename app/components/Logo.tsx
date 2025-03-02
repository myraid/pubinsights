import Image from "next/image"

export default function Logo() {
  return (
    <Image
      src="/images/logo.png"
      alt="Publisher Insights"
      width={150}
      height={40}
      className="w-auto h-8"
    />
  )
}

