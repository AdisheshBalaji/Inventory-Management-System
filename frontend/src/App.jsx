import {Route, Routes} from 'react-router-dom'
import Login from './pages/login'
import Register from './pages/register'
import Dashboard from './pages/dashboard'
import CustomerLogin from './pages/customer-login'
import CustomerProducts from './pages/customer-products'

function App(){
  return(
      <Routes>
        <Route path = "/login" element={<Login/>}/>
        <Route path = "/register" element={<Register/>}/>
        <Route path = "/dashboard" element={<Dashboard/>}/>
        <Route path = "/customer-login" element = {<CustomerLogin/>}/>
        <Route path = "/customer-products" element = {<CustomerProducts/>}/>
      </Routes>

  )
}


export default App
